import got from "got"

const config = require("./build/config.json")

const run = (action: () => void) => action()

const request = (path: string) => got(config.gitlab.api + path, {
  headers: {
    "Private-Token": config.gitlab.token,
    "User-Agent": "github.com/hastebrot/gitlab-summary"
  }
})

// run(async () => {
//   const path = "/v4/projects?per_page=100"
//   const response = await request(path)
//   console.log(response.statusCode)
//   console.log(response.statusMessage)

//   const projects: any[] = JSON.parse(response.body)
//   projects.forEach(project => {
//     console.log(project.id, project.name, project.path_with_namespace, project._links.merge_requests)
//   })
// })

run(async () => {
  const path = "/v4/projects/" + config.gitlab.project + "/merge_requests?state=opened&per_page=100"
  const response = await request(path)
  // console.log(response.statusCode)
  // console.log(response.statusMessage)

  const mergeRequests: any[] = JSON.parse(response.body)
  const ids: number[] = []
  mergeRequests.forEach(mergeRequest => {
    // console.log(mergeRequest.id, mergeRequest.iid, mergeRequest.title,
    //   mergeRequest.author.username, mergeRequest.work_in_progress)
    ids.push(mergeRequest.iid)
  })

  const results: any = []
  ids.forEach(id => {
    run(async () => {
      const path = "/v4/projects/" + config.gitlab.project + "/merge_requests/" + id + "/changes"
      const response = await request(path)
      // console.log(response.statusCode)
      // console.log(response.statusMessage)

      const mergeRequest: any = JSON.parse(response.body)
      results.push({
        id: mergeRequest.iid,
        title: mergeRequest.title,
        author: mergeRequest.author.username,
        files: mergeRequest.changes.map((it: any) => it.new_path).length,
        update: mergeRequest.updated_at
      })
    })
  })

  setTimeout(() => {
    console.log(results)
  }, 2500)
})

// http://gitlab.example.com/users/auth/gitlab/callback
// curl https://gitlab.example.com/api/v4/projects?private_token=1a2b3c4d5e
// curl --header "Private-Token: 1a2b3c4d5e" https://gitlab.example.com/api/v4/projects

// https://docs.gitlab.com/ee/api/projects.html#list-all-projects
// https://docs.gitlab.com/ee/api/merge_requests.html#list-project-merge-requests
