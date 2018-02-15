import got from "got"

const config = require("./build/config.json")

const run = (action: () => void) => action()

run(async () => {
  const url = config.gitlab.api + "/v4/projects"
  const response = await got(url, {
    headers: {
      "Private-Token": config.gitlab.token
    }
  })
  console.log(response.statusCode)
  console.log(response.statusMessage)
  console.log(response.body)
})

// http://gitlab.example.com/users/auth/gitlab/callback
// curl https://gitlab.example.com/api/v4/projects?private_token=1a2b3c4d5e
// curl --header "Private-Token: 1a2b3c4d5e" https://gitlab.example.com/api/v4/projects
