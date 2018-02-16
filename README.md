## gitlab-summary

> Lists open merge requests of GitLab projects.

~~~
  Usage
    $ lab <command> [project name]

  Examples
    $ lab projects
    $ lab projects foo
    $ lab reviews foo
~~~

Configure the GitLab server and your access token in `build/config.json`:

~~~json
{
  "gitlab": {
    "api": "https://gitlab.example.com/api",
    "token": "a1b2c3d4e5"
  },
  "alarms": {
    "gradle files were changed": ["**/*.gradle"],
    "html files were changed": ["**/*.{htm,html}"],
    "java files were changed": ["**/*.java"],
    "js files were changed": ["**/*.js"]
  }
}
~~~
