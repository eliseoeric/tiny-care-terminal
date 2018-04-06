var Asana = require('asana');
var util = require('util');
var config = require(__dirname + '/config.js');

// Here we are using the API key for basic auth - todo switch to Oauth
var client = Asana.Client.create().useBasicAuth(config.asana.api_key);

function getTasks() {
  var status = config.asana.status.split(',');
  return client.users.me()
    .then(function(user) {
      var userId = user.id;
      var workspace = user.workspaces.filter(workspace => workspace.name === config.asana.workspace)[0];
      return client.tasks.findAll({
        assignee: userId,
        workspace: workspace.id,
        completed_since: 'now',
        opt_fields: 'id,name,assignee_status,completed'
      });
    })
    .then(response => response.data)
    .filter(task => status.includes(task.assignee_status));
}

module.exports.getTasks = getTasks;