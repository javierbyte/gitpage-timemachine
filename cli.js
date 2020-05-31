const CONFIG = require("./config.js");

const kMaxCommitAmmount = CONFIG.maxImages || 32;

const nodeGitHistory = require("node-git-history");
const _ = require("lodash");
const async = require("async");
const rimraf = require("rimraf");

const exec = require("child_process").exec;
const execSync = require("child_process").execSync;
const fs = require("fs");

let GLOBALcommitLength = 0;
let GLOBALcommitCount = 0;

async function takeScreenshot(commit) {
  const { sha } = commit;
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // await page.goto('http://localhost:9142/');
  console.log("navigate", sha);
  await page.goto("http://localhost:9142/", { waitUntil: "networkidle2" });

  await page.setViewport({
    width: 1440,
    height: 900,
  });

  console.log("screenshot", sha);
  await page.screenshot({ path: `./pageData/${sha}.jpg`, quality: 60, type: "jpeg" });
  await browser.close();

  // return new Promise((resolve) => {
  //  const toExec = `node /Users/javierbyte/Desktop/test/index.js --url="http://localhost:9142/" --output=${sha}.jpg --outputDir=./pageData/`;
  // });
}

async function getAsyncScreenshot(commit) {
  await takeScreenshot(commit);
}

async function checkoutCommit(commit) {
  const { sha, date } = commit;
  console.log(`checkoutCommit: ${sha}`);

  return new Promise((resolve, reject) => {
    console.log(
      `> cd _git && git checkout -- . && git checkout ${sha} && git reset --hard`
    );

    console.log(
      parseInt(sha, 16) > parseInt("d4b8d452665a22ae410f74d5eb20960aabc8a764", 16),
      date
    );

    exec(
      `cd _git && git clean -df && git checkout -- . && git checkout ${sha} && git reset --hard`,
      function (error, stdout, stderr) {
        console.log(
          "" +
            execSync(
              `mkdir -p _git/docs && touch _git/docs/safe.txt && cp -r _git/docs/* _git/`
            )
        );

        if (error) {
          return reject(error);
        }

        resolve(stdout + stderr);
      }
    );
  });
}

async function getCommitScreenshot(commit) {
  const { sha } = commit;

  GLOBALcommitCount++;

  console.log(`\ngetting screenshot ${GLOBALcommitCount}/${GLOBALcommitLength}`);

  if (fs.existsSync(`pageData/${sha}.jpg`)) {
    console.log(`file already exists ${sha}`);
    return new Promise((resolve) => resolve());
  }

  console.log(`getCommitScreenshot: ${sha}`);

  await checkoutCommit(commit);
  await getAsyncScreenshot(commit);
}

function getCommitHistory() {
  console.log("reading commit history");

  return new Promise((resolve, reject) => {
    nodeGitHistory("_git", ["H", "an", "s", "ad"])
      .then((gitRes) => {
        resolve(
          gitRes.map((gitRow) => {
            return {
              sha: gitRow.H,
              author: gitRow.an,
              message: gitRow.s,
              date: new Date(gitRow.ad).getTime(),
            };
          })
        );
      })
      .catch(reject);
  });
}

function saveJson(json) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      "pageData/site.json",
      JSON.stringify(
        {
          repo: CONFIG.repo,
          commits: json,
        },
        0,
        2
      ),
      "utf8",
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
  console.log("rimraf _git");

  return new Promise((resolve, reject) => {
    try {
      rimraf("_git", resolve);
    } catch (e) {
      reject(e);
    }
  });
}

function cloneRepo(repo) {
  return new Promise((resolve, reject) => {
    console.log(`> mkdir -p pageData && git clone ${repo} _git`);

    exec(`mkdir -p pageData && git clone ${repo} _git`, function (error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      resolve(stdout + stderr);
    });
  });
}

let HTTPSERVER;

function runHttpServer() {
  console.log("run http server");

  return new Promise((resolve, reject) => {
    // parseInt("d4b8d452665a22ae410f74d5eb20960aabc8a764", 16)
    // console.log(`> cd _git/docs && python -m SimpleHTTPServer 9142`);
    console.log(`> serve _git/ -l 9142`);

    try {
      HTTPSERVER = exec("serve _git/ -l 9142");
      setTimeout(() => {
        resolve();
      }, 1024);
    } catch (e) {
      reject(e);
    }
  });
}

function killHttpServer() {
  console.log("\nkill http server");
  HTTPSERVER.kill();
}

rimrafGit()
  .then(() => cloneRepo(CONFIG.repo))
  .then(runHttpServer)
  .then(getCommitHistory)
  .then((gitLog) => {
    if (!CONFIG.ignoreCommits) {
      return gitLog;
    }

    return _.filter(gitLog, (gitLogEl) => {
      return !_.includes(CONFIG.ignoreCommits.slice(-7), gitLogEl.sha.slice(-7));
    });
  })
  .then((gitLog) => {
    return _.filter(gitLog, (gitLogEl, gitLogIdx) => {
      return gitLogIdx % Math.ceil(gitLog.length / kMaxCommitAmmount) === 0;
    });
  })
  .then((gitLog) => {
    GLOBALcommitLength = gitLog.length;

    console.log(`Saving json, ${gitLog.length} elements`);

    return saveJson(gitLog);
  })
  .then((gitLog) => {
    return new Promise((resolve, reject) => {
      async.waterfall(
        _.map(gitLog, (commit) => {
          return function (cb) {
            getCommitScreenshot(commit).then(() => cb(null));
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
    console.log("\n\nDone!");
    process.exit();
  })
  .catch((err) => {
    console.error(err);
  });
