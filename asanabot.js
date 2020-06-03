var Asana = require("asana");
var util = require("util");
var config = require(__dirname + "/config.js");

// Here we are using the API key for basic auth - todo switch to Oauth

var client = Asana.Client.create().useBasicAuth(config.asana.api_key);

function getWorkspaces(user) {
  return user.workspaces.filter((workspace) =>
    config.asana.workspaces.includes(workspace.name)
  );
}

function getUser() {
  return client.users.me();
}

async function workspaceTasks(workspace, userId) {
  return client.tasks
    .findAll({
      assignee: userId,
      workspace: workspace.gid,
      completed_since: "now",
      opt_fields: "id,name,assignee_status,completed",
    })
    .then((collection) => {
      return collection.fetch(20).then((tasks) => tasks);
    }).then(tasks => {
      return {
        workspace: workspace.name,
        gid: workspace.gid,
        tasks: tasks
      }
    })
    .catch((error) => console.error(error.value));
}

async function getTasks() {
  var status = config.asana.status.split(",");
  var user = await getUser();
  var workspaces = getWorkspaces(user);

  return Promise.all(
    workspaces.map((workspace) => workspaceTasks(workspace, user.gid))
  );
}

module.exports.getTasks = getTasks;
