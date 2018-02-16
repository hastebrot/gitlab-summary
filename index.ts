import got from "got"
import meow from "meow"
import chalk from "chalk"
import micromatch from "micromatch"
import { queue } from "d3-queue"
import { DateTime } from "luxon"

if (require.main === module) {
  const config = require("./build/config.json")
  const help = `
    Usage
      $ lab <command> [project name]

    Examples
      $ lab projects
      $ lab projects foo
      $ lab reviews foo
      $ lab reviews foo --files
      $ lab reviews foo --alarms
  `

  const cli = meow(help, {
    flags: {
      files: {
        type: "boolean"
      },
      alarms: {
        type: "boolean"
      }
    }
  })

  if (cli.input.length === 0) {
    cli.showHelp(0)
  }
  else {
    console.log(chalk.green("*** " + (cli.pkg as any).name + " ***"))
    console.log("")

    if (cli.input[0] === "projects") {
      fetchProjectList(config, cli.input[1])
    }
    else if (cli.input[0] === "reviews") {
      fetchMergeRequestList(config, cli.input[1], cli.flags.files, cli.flags.alarms)
    }
  }
}

export function fetchProjectList(config: any, projectName: string) {
  run(async () => {
    let path = pathsProjects()
    if (projectName) {
      path = pathsProject(projectName)
    }
    const response = await request(config, path)
    // console.log(response.statusCode, response.statusMessage)

    const projects: any[] = JSON.parse(response.body)
    projects.forEach(project => {
      console.log([
        chalk.underline(project.id), chalk.cyan(project.name),
        project.path_with_namespace
      ].join(" "))
    })
    console.log("")
  })
}

export function fetchMergeRequestList(config: any, projectName: string,
    showFiles: boolean = false, showAlarms: boolean = false) {
  const extensionsGlob = "**/*.{java,js,htm,html,gradle}"

  run(async () => {
    const path = pathsProject(projectName || config.gitlab.project)
    const response = await request(config, path)
    // console.log(response.statusCode, response.statusMessage)

    const projects: any[] = JSON.parse(response.body)

    if (projects.length > 0) {
      const project = projects[0]
      console.log([
        chalk.underline(project.id), chalk.cyan(project.name),
        project.path_with_namespace, chalk.yellow(extensionsGlob)
      ].join(" "))
      console.log("")

      run(async () => {
        const path = pathsMergeRequests(project.id)
        const response = await request(config, path)
        // console.log(response.statusCode, response.statusMessage)

        const mergeRequests: any[] = JSON.parse(response.body)
        const ids: string[] = []
        mergeRequests.forEach(mergeRequest => {
          // console.log([
          //   mergeRequest.id, mergeRequest.iid, chalk.redBright(mergeRequest.title),
          //   mergeRequest.author.username, mergeRequest.work_in_progress
          // ].join(" "))
          ids.push(mergeRequest.iid)
        })

        const q = queue()
        const results: any = []
        ids.forEach(id => {
          q.defer(async done => {
            const path = pathsMergeRequest(project.id, id)
            const response = await request(config, path)
            // console.log(response.statusCode, response.statusMessage)

            const mergeRequest: any = JSON.parse(response.body)
            results.push({
              id: mergeRequest.iid,
              title: mergeRequest.title,
              author: mergeRequest.author.username,
              files: mergeRequest.changes.map((it: any) => {
                const ADDED = chalk.green("(+)")
                const REMOVED = chalk.red("(-)")
                const MODIFIED = chalk.yellow("(~)")
                let status = MODIFIED
                if (it.renamed_file) { status = MODIFIED }
                if (it.new_file) { status = ADDED }
                if (it.deleted_file) { status = REMOVED }
                return {
                  path: it.new_path,
                  status
                }
              }),
              created: DateTime.fromISO(mergeRequest.created_at),
              updated: DateTime.fromISO(mergeRequest.updated_at),
              upvotes: mergeRequest.upvotes,
              downvotes: mergeRequest.downvotes
            })
            done(null)
          })
        })

        q.await(() => {
          const now = DateTime.local()

          results.sort((a: any, b: any) => {
            return b.updated.valueOf() - a.updated.valueOf()
          })

          results.forEach((result: any) => {
            const updatedDiff = now.diff(result.updated, ["hours", "minutes"])
              .toObject()
            const updatedDiffStr = `${updatedDiff.hours} hours, `
              + `${Math.round(updatedDiff.minutes as number)} mins ago`

            console.log([
              chalk.underline(result.id),
              `${chalk.green("+" + result.upvotes)} ${chalk.red("-" + result.downvotes)}`,
              chalk.cyan(result.title), result.author,
              `(${result.files.length + " files"})`, chalk.yellow(updatedDiffStr)
            ].join(" "))
            console.log("")

            if (showAlarms) {
              const alarms = config.alarms || {}
              Object.keys(alarms).forEach(message => {
                const paths = result.files.map((file: any) => file.path)
                const globs = alarms[message]
                const match = micromatch(paths, globs)
                if (match.length > 0) {
                  console.log(`${chalk.dim(chalk.yellow("(" + match.length + ")"))} `
                    + `${chalk.dim(message)}`)
                }
              })
              console.log("")
            }

            if (showFiles) {
              result.files
                .filter((file: any) =>
                  micromatch.isMatch(file.path, extensionsGlob)
                )
                .forEach((file: any) => {
                  console.log(`${chalk.dim(file.status)} ${chalk.dim(file.path)}`)
                })
              console.log("")
            }
          })
        })
      })
    }
  })
}

function pathsProjects(): string {
  return "/v4/projects?per_page=100&simple=true"
    + "&order_by=last_activity_at&sort=desc"
}

function pathsProject(projectName: string): string {
  return "/v4/projects?per_page=100&simple=true"
    + "&search=" + projectName + "&order_by=created_at&sort=asc"
}

function pathsMergeRequests(projectId: string): string {
  return "/v4/projects/" + projectId + "/merge_requests"
    + "?state=opened&per_page=100&order_by=updated_at&sort=desc"
}

function pathsMergeRequest(projectId: string, mergeRequestId: string): string {
  return "/v4/projects/" + projectId + "/merge_requests/"
    + mergeRequestId + "/changes?per_page=100"
}

function run(action: () => void) {
  action()
}

function request(config: any, path: string) {
  return got(config.gitlab.api + path, {
    headers: {
      "Private-Token": config.gitlab.token,
      "User-Agent": "github.com/hastebrot/gitlab-summary"
    }
  })
}
