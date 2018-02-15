import got from "got"
import meow from "meow"
import chalk from "chalk"
import micromatch from "micromatch"
import { queue } from "d3-queue"
import { DateTime } from "luxon"

if (require.main === module) {
  const config = require("./build/config.json")
  const cli = meow({})

  console.log(chalk.green("*** " + (cli.pkg as any).name + " ***"))
  console.log("")

  if (cli.input[0] === "projects") {
    fetchProjectList(config)
  }
  else if (cli.input[0] === "reviews") {
    fetchMergeRequestList(config)
  }
}

export function fetchProjectList(config: any) {
  run(async () => {
    const path = pathsProjects()
    const response = await request(config, path)
    // console.log(response.statusCode, response.statusMessage)

    const projects: any[] = JSON.parse(response.body)
    projects.forEach(project => {
      console.log([
        chalk.underline(project.id), chalk.redBright(project.name),
        project.path_with_namespace
      ].join(" "))
    })
  })
}

export function fetchMergeRequestList(config: any) {
  run(async () => {
    const path = pathsProject(config.gitlab.project)
    const response = await request(config, path)
    // console.log(response.statusCode, response.statusMessage)

    const projects: any[] = JSON.parse(response.body)

    if (projects.length > 0) {
      const project = projects[0]
      console.log([
        chalk.underline(project.id), chalk.redBright(project.name),
        project.path_with_namespace
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
              files: mergeRequest.changes.map((it: any) => it.new_path),
              created: DateTime.fromISO(mergeRequest.created_at),
              updated: DateTime.fromISO(mergeRequest.updated_at)
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
              chalk.underline(result.id), chalk.redBright(result.title),
              result.author, `[${result.files.length}]`, chalk.yellow(updatedDiffStr)
            ].join(" "))
            console.log("")
            micromatch(result.files, "**/*.{java,js,html,gradle}").forEach(path => {
              console.log(`${chalk.dim("-")} ${chalk.dim(path)}`)
            })
            console.log("")
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
