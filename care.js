#!/usr/bin/env node
var config = require(__dirname + '/config.js');
var twitterbot = require(__dirname + '/twitterbot.js');
var gitbot = require(__dirname + '/gitbot.js');
var pomodoro = require(__dirname + '/pomodoro.js');
var getAnsiArt = require(__dirname + '/ansiart.js');
var asanabot = require(__dirname + '/asanabot.js');

var path = require('path');
var resolve = require('resolve-dir');
var notifier = require('node-notifier');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var chalk = require('chalk');
var weather = require('weather-js');
var openBrowser = require("opn");

var inPomodoroMode = false;
var asanaTasks = [];

var screen = blessed.screen({
  fullUnicode: true, // emoji or bust
  smartCSR: true,
  autoPadding: true,
  title: config.terminal_title
});

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

// Refresh on r, or Control-R.
screen.key(['r', 'C-r'], function(ch, key) {
  tick();
});

screen.key(['s', 'C-s'], function(ch, key) {
  if (!inPomodoroMode) {
    return;
  } else if (pomodoroObject.isStopped()) {
    pomodoroObject.start();
  } else if (pomodoroObject.isPaused()) {
    pomodoroObject.resume();
  } else {
    pomodoroObject.pause();
    pomodoroHandlers.onTick();
  }
});

screen.key(['e', 'C-e'], function(ch, key) {
  if (inPomodoroMode) {
    pomodoroObject.stop();
    pomodoroHandlers.onTick();
  }
});

screen.key(['u', 'C-u'], function(ch, key) {
  if (inPomodoroMode) {
    pomodoroObject.updateRunningDuration();
    pomodoroHandlers.onTick();
  }
});

screen.key(['b', 'C-b'], function(ch, key) {
  if (inPomodoroMode) {
    pomodoroObject.updateBreakDuration();
    pomodoroHandlers.onTick()
  }
});

screen.key(['p', 'C-p'], function(ch, key) {
  if (inPomodoroMode) {
    pomodoroObject.stop();
    inPomodoroMode = false;
    // doTheTweets();
    parrotBox.removeLabel('');
  } else {
    parrotBox.setLabel(' 🍅 ');
    inPomodoroMode = true;
    pomodoroHandlers.onTick()
  }
});

var grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

// grid.set(row, col, rowSpan, colSpan, obj, opts)
var weatherBox = grid.set(6, 8, 2, 4, blessed.box, makeScrollBox(' 🌤 '));
var todayBox = grid.set(0, 0, 6, 6, blessed.box, makeScrollBox(' 📝  Last 24 hours '));
var weekBox = grid.set(6, 0, 6, 6, blessed.box, makeScrollBox(' 📝  Week '));
var commits = grid.set(6, 6, 6, 2, contrib.bar, makeGraphBox('Commits'));
var parrotBox = grid.set(8, 8, 4, 4, blessed.box, makeScrollBox(''));

// var tweetBoxes = {}
// tweetBoxes[config.twitter[1]] = grid.set(2, 8, 2, 4, blessed.box, makeBox(' 💖 '));
// tweetBoxes[config.twitter[2]] = grid.set(4, 8, 2, 4, blessed.box, makeBox(' 💬 '));

var asanaBox = grid.set(0, 6, 6, 6, blessed.listtable, makeListTable(' Asana Tasks ', 'left',  0, true)); 

asanaBox.on('select', (data, index) => {
  var selectedTask = asanaTasks[index - 1];
  var project = selectedTask.projects[0];
  openBrowser(`https://app.asana.com/0/${project.gid}/${selectedTask.gid}`);
});

tick();
setInterval(tick, 1000 * 60 * config.updateInterval);

function tick() {
  doTheWeather();
  // doTheTweets();
  doTheCodes();
  doTheTasks();
}

function doTheWeather() {
  weather.find({search: config.weather, degreeType: config.celsius ? 'C' : 'F'}, function(err, result) {
    if (result && result[0] && result[0].current) {
      var json = result[0];
      // TODO: add emoji for this thing.
      var skytext = json.current.skytext.toLowerCase();
      var currentDay = json.current.day;
      var degreetype = json.location.degreetype;
      var forecastString = '';
      for (var i = 0; i < json.forecast.length; i++) {
        var forecast = json.forecast[i];
        if (forecast.day === currentDay) {
          var skytextforecast = forecast.skytextday.toLowerCase();
          forecastString = `Today, it will be ${skytextforecast} with a forecast high of ${forecast.high}°${degreetype} and a low of ${forecast.low}°${degreetype}.`;
        }
      }
      weatherBox.content = `In ${json.location.name} it's ${json.current.temperature}°${degreetype} and ${skytext} right now. ${forecastString}`;
    } else {
      weatherBox.content = 'Having trouble fetching the weather for you :(';
    }
  });
}

function doTheTasks() {

  // show loading message while loading commits
  asanaBox.content = 'one second please...tiny asana bot is looking for tiny tasks!';
  screen.render();

  
  asanabot.getTasks().then(function(workspaces) {
    asanaBox.content = '';

    asanaTasks = workspaces.flat();

    var rows = asanaTasks.map(task => [task.name, task.workspace.name, task.assignee_status])
    var headers = ['task', 'workspace', 'status'];
    
    asanaBox.setData([
      headers,
      ...rows
    ])

    screen.render();
    asanaBox.focus();
  });
}

function doTheTweets() {
  for (var which in config.twitter) {
    // Gigantor hack: first twitter account gets spoken by the party parrot.
    if (which == 0) {
      if (inPomodoroMode) {
        return;
      }
      twitterbot.getTweet(config.twitter[which]).then(function(tweet) {
        parrotBox.content = getAnsiArt(config.say, tweet.text)
        screen.render();
      },function(error) {
        // Just in case we don't have tweets.
        parrotBox.content = getAnsiArt(config.say, 'Hi! You\'re doing great!!!')
        screen.render();
      });
    } else {
      twitterbot.getTweet(config.twitter[which]).then(function(tweet) {
        tweetBoxes[tweet.bot.toLowerCase()].content = tweet.text;
        screen.render();
      },function(error) {
        tweetBoxes[config.twitter[1]].content =
        tweetBoxes[config.twitter[2]].content =
        'Can\'t read Twitter without some API keys  🐰. Maybe try the scraping version instead?';
      });
    }
  }
}

function doTheCodes() {
  var todayCommits = 0;
  var weekCommits = 0;

  // show loading message while loading commits.
  // Turns out blessed doesn't love it if there's emoji in this or if
  // the line is super long.
  todayBox.content = weekBox.content = 'tiny commit bot is looking for tiny commits! ';
  screen.render();

  function getCommits(data, box) {
    var content = colorizeLog(data || '');
    box.content += content;
    var commitRegex = /(.......) (- .*)/g;
    return (box && box.content) ? (box.content.match(commitRegex) || []).length : '0';
  }

  function showError(err) {
    todayBox.content = 'ERROR: ' + (err.message || err);
    return screen.render();
  }

  gitbot.findGitRepos(config.repos, config.depth-1, (err, allRepos) => {
    if (err) return showError(err);
    gitbot.getCommitsFromRepos(allRepos, 1, (err, data) => {
      if (err) return showError(err);
      todayBox.content = '';
      todayCommits = getCommits(`${data}`, todayBox);
      updateCommitsGraph(todayCommits, weekCommits);
      screen.render();
    });
    gitbot.getCommitsFromRepos(allRepos, 7, (err, data) => {
      if (err) return showError(err);
      weekBox.content = '';
      weekCommits = getCommits(`${data}`, weekBox);
      updateCommitsGraph(todayCommits, weekCommits);
      screen.render();
    });
  });
}

function makeBox(label) {
  return {
    label: label,
    tags: true,
    // draggable: true,
    border: {
      type: 'line'  // or bg
    },
    style: {
      border: { fg: 'cyan' },
      hover: { border: { fg: 'green' }, }
    }
  };
}

function makeScrollBox(label) {
  var options = makeBox(label);
  options.scrollable = true;
  options.scrollbar = { ch:' ' };
  options.style.scrollbar = { bg: 'green', fg: 'white' }
  options.keys = true;
  options.vi = true;
  options.alwaysScroll = true;
  options.mouse = true;
  return options;
}

function makeListTable(label, alignment, padding, isInteractive = false) {
  return {
    parent: screen,
    keys: true,
    label: label,
    align: alignment,
    selectedFg: "white",
    selectedBg: "blue",
    interactive: isInteractive, // Makes the list table scrollable
    padding: padding,
    mouse: true,
    dockBorders: true,
    style: {
      fg: 'white',
      border: { fg: 'cyan' },
      hover: { border: { fg: 'green' }, },
      cell: {
        selected: {
          fg: "black",
          bg: "cyan"
        }
      },
      header: {
        fg: "red",
        bold: true
      }
    },
    columnSpacing: 1
  };
}

function makeGraphBox(label) {
  var options = makeBox(label);
  options.barWidth= 5;
  options.xOffset= 4;
  options.maxHeight= 10;
  options.labelColor = 'normal';
  return options;
}

function updateCommitsGraph(today, week) {
  commits.setData({titles: ['24h', 'week'], data: [today, week]})
}

function colorizeLog(text) {
  var lines = text.split('\n');
  var regex = /(.......) (- .*) (\(.*\)) (<.*>)/i;
  var nothingRegex = /Seems like .* did nothing/i;
  for (var i = 0; i < lines.length; i++) {
    // If it's a path
    if (lines[i][0] === '/') {
      lines[i] = formatRepoName(lines[i], '/')
    } else if(lines[i][0] === '\\') {
      lines[i] = formatRepoName(lines[i], '\\')
    } else {
      // It may be a mean "seems like .. did nothing!" message. Skip it
      var nothing = lines[i].match(nothingRegex);
      if (nothing) {
        lines[i] = '';
        continue;
      }

      // It's a commit.
      var matches = lines[i].match(regex);
      if (matches) {
        lines[i] = chalk.red(matches[1]) + ' ' + matches[2] + ' ' +
          chalk.green(matches[3])
      }
    }
  }
  return lines.join('\n');
}

function formatRepoName(line, divider) {
  var repoPath = config.repos
    .map(resolve)
    .sort((a, b) => a.length < b.length) // Longest repo repoPath first
    .find(repo => line.startsWith(repo));
  var repoRootPath = chalk.yellow(path.basename(repoPath) + divider);
  var repoChildPath = chalk.yellow.bold(
    line.replace(repoPath, '').replace(new RegExp(`^${divider}`), '')
  );
  return `\n${repoRootPath}${repoChildPath}`;
}

var pomodoroHandlers = {
  onTick: function() {
    if (!inPomodoroMode) return;
    var remainingTime = pomodoroObject.getRemainingTime();

    var statusText = '';
    if (pomodoroObject.isInBreak()) {
      statusText = ' (Break Started) ';
    } else if (pomodoroObject.isStopped()) {
      statusText = ' (Press "s" to start) ';
    } else if (pomodoroObject.isPaused()) {
      statusText = ' (Press "s" to resume) ';
    }

    var content = `In Pomodoro Mode: ${remainingTime} ${statusText}`;
    var metaData = `Duration: ${pomodoroObject.getRunningDuration()} Minutes,  Break Time: ${pomodoroObject.getBreakDuration()} Minutes\n`;
    metaData += 'commands: \n s - start/pause/resume \n e - stop \n u - update duration \n b - update break time';
    parrotBox.content = getAnsiArt(config.say, content) + metaData;
    screen.render();
  },

  onBreakStarts: function() {
    if (inPomodoroMode) {
      notifier.notify({
        title: 'Pomodoro Alert',
        message: 'Break Time!',
        sound: true,
        timeout: 30,
      });
    }
  },

  onBreakEnds: function() {
    if (inPomodoroMode) {
      notifier.notify({
        title: 'Pomodoro Alert',
        message: 'Break Time Ends!',
        sound: true,
        timeout: 30,
      });
    }
  },

  runningDuration: parseInt(config.runningDuration, 10),

  breakDuration: parseInt(config.breakDuration, 10),
}

var pomodoroObject = pomodoro(pomodoroHandlers);