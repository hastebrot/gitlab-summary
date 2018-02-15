import got from "got"
import { queue } from "d3-queue"

if (require.main === module) {
  const config = require("./build/config.json")
  // fetchProjectList(config)
  fetchMergeRequestList(config)
}

export function pathsProjects(): string {
  return "/v4/projects?per_page=100"
}

export function pathsMergeRequests(projectId: string): string {
  return "/v4/projects/" + projectId + "/merge_requests"
    + "?state=opened&per_page=100"
}

export function pathsMergeRequest(projectId: string,
                                  mergeRequestId: string): string {
  return "/v4/projects/" + projectId + "/merge_requests/"
    + mergeRequestId + "/changes?per_page=100"
}

export function fetchProjectList(config: any) {
  run(async () => {
    const path = pathsProjects()
    const response = await request(config, path)
    console.log(response.statusCode, response.statusMessage)

    const projects: any[] = JSON.parse(response.body)
    projects.forEach(project => {
      console.log(project.id, project.name, project.path_with_namespace, project._links.merge_requests)
    })
  })
}

export function fetchMergeRequestList(config: any) {
  run(async () => {
    const path = pathsMergeRequests(config.gitlab.project)
    const response = await request(config, path)
    console.log(response.statusCode, response.statusMessage)

    const mergeRequests: any[] = JSON.parse(response.body)
    const ids: string[] = []
    mergeRequests.forEach(mergeRequest => {
      // console.log(mergeRequest.id, mergeRequest.iid, mergeRequest.title,
      //   mergeRequest.author.username, mergeRequest.work_in_progress)
      ids.push(mergeRequest.iid)
    })

    const q = queue()
    const results: any = []
    ids.forEach(id => {
      q.defer(async done => {
        const path = pathsMergeRequest(config.gitlab.project, id)
        const response = await request(config, path)
        console.log(response.statusCode, response.statusMessage)

        const mergeRequest: any = JSON.parse(response.body)
        results.push({
          id: mergeRequest.iid,
          title: mergeRequest.title,
          author: mergeRequest.author.username,
          files: mergeRequest.changes.map((it: any) => it.new_path).length,
          update: mergeRequest.updated_at
        })
        done(null)
      })
    })

    q.await(() => {
      console.log(results)
    })
  })
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
