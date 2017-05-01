const CONFIG = require('./config.js');

const kMaxCommitAmmount = CONFIG.maxImages || 32;

const Git = require('nodegit');
const Pageres = require('pageres');
const _ = require('lodash');
const async = require('async');
const rimraf = require('rimraf');

const exec = require('child_process').exec;
const fs = require('fs');

let GLOBALcommitLength = 0;
let GLOBALcommitCount = 0;

function getScreenshot(hash) {
  console.log(`getScreenshot: ${hash}`);

  return new Pageres({ delay: 1.5 })
    .src('localhost:9142', ['1280x900'], {
      crop: true,
      filename: hash,
      format: 'jpg',
      css: 'body{height: 900px}'
    })
    .dest('./pageData')
    .run();
}

function checkoutCommit(hash) {
  console.log(`checkoutCommit: ${hash}`);

  return new Promise((resolve, reject) => {
    console.log(`> cd _git && git checkout ${hash}`);

    exec(`cd _git && git checkout ${hash}`, function(error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      resolve(stdout + stderr);
    });
  });
}

function getCommitScreenshot(hash) {
  GLOBALcommitCount++;

  console.log(`\ngetting screenshot ${GLOBALcommitCount}/${GLOBALcommitLength}`);

  if (fs.existsSync(`pageData/${hash}.jpg`)) {
    console.log(`file already exists ${hash}`);
    return new Promise(resolve => resolve());
  }

  console.log(`getCommitScreenshot: ${hash}`);

  return checkoutCommit(hash).then(() => {
    return getScreenshot(hash);
  });
}

function getCommitHistory() {
  console.log('reading commit history');

  return new Promise((resolve, reject) => {
    const gitLog = [];

    let hashCount = 0;

    console.log('Open _git folder');

    Git.Repository
      .open('_git')
      .then(repo => {
        console.log('_git folder opened');
        return repo.getMasterCommit();
      })
      .then(firstCommitOnMaster => {
        const history = firstCommitOnMaster.history();

        history.on('commit', function(commit) {
          hashCount++;

          gitLog.push({
            sha: commit.sha(),
            author: commit.author().name(),
            message: commit.message(),
            date: new Date(commit.date()).getTime()
          });
        });

        history.on('end', function() {
          resolve(gitLog);
        });

        history.start();
      })
      .catch(reject);
  });
}

function saveJson(json) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      'pageData/site.json',
      JSON.stringify({
        repo: CONFIG.repo,
        commits: json
      }),
      'utf8',
      (err, res) => {
        if (err) {
          return reject(err);
        }

        resolve(json);
      }
    );
  });
}

function rimrafGit() {
  console.log('rimraf _git');

  return new Promise((resolve, reject) => {
    try {
      rimraf('_git', resolve);
    } catch (e) {
      reject(e);
    }
  });
}

function cloneRepo(repo) {
  return new Promise((resolve, reject) => {
    console.log(`> mkdir -p pageData && git clone ${repo} _git`);

    exec(`mkdir -p pageData && git clone ${repo} _git`, function(error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      resolve(stdout + stderr);
    });
  });
}

let HTTPSERVER;

function runHttpServer() {
  console.log('run http server');

  return new Promise((resolve, reject) => {
    console.log(`> cd _git && python -m SimpleHTTPServer 9142`);

    try {
      HTTPSERVER = exec('cd _git && python -m SimpleHTTPServer 9142');
      setTimeout(() => {
        resolve();
      }, 1024);
    } catch (e) {
      reject(e);
    }
  });
}

function killHttpServer() {
  console.log('\nkill http server');
  HTTPSERVER.kill();
}

rimrafGit()
  .then(() => cloneRepo(CONFIG.repo))
  .then(runHttpServer)
  .then(getCommitHistory)
  .then(gitLog => {
    if (!CONFIG.ignoreCommits) {
      return gitLog;
    }

    return _.filter(gitLog, gitLogEl => {
      return !_.includes(CONFIG.ignoreCommits, gitLogEl.sha);
    });
  })
  .then(gitLog => {
    return _.filter(gitLog, (gitLogEl, gitLogIdx) => {
      return gitLogIdx % Math.ceil(gitLog.length / kMaxCommitAmmount) === 0;
    });
  })
  .then(gitLog => {
    GLOBALcommitLength = gitLog.length;

    console.log(`Saving json, ${gitLog.length} elements`);

    return saveJson(gitLog);
  })
  .then(gitLog => {
    return new Promise((resolve, reject) => {
      async.waterfall(
        _.map(_.map(gitLog, 'sha'), hash => {
          return function(cb) {
            getCommitScreenshot(hash).then(() => cb(null));
          };
        }),
        (err, res) => {
          if (err) {
            return reject(err);
          }

          return resolve(res);
        }
      );
    });
  })
  .then(killHttpServer)
  .then(() => {
    console.log('\n\nDone!');
    process.exit();
  })
  .catch(err => {
    console.error(err);
  });
