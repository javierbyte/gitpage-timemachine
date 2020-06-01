<template>
  <div>
    <div class="screenshot-container">
      <div
        v-if="!loading"
        class="screenshot-container-content"
        :style="{
          height: 100 + commits.length * 10 + 'vmax',
        }"
      >
        <img
          v-for="(commit, commitIndex) in commits"
          :key="commit.sha"
          class="screenshot"
          :src="'pageData/' + commit.sha + '.jpg'"
          :style="getThumbStyle(commitIndex)"
          alt=""
        />

        <div class="commit-info" v-if="currentCommit">
          {{ currentCommit.message }}
          <span class="commit-info-author">
            --{{ currentCommit.author }}
            {{ currentCommit.dateStr }}
            <a
              :href="
                `https://github.com/javierbyte/javierbyte.github.io/commit/${currentCommit.sha}`
              "
              >#{{ currentCommit.sha.slice(0, 7) }}</a
            >
          </span>
        </div>
      </div>

      <div v-if="loading" class="loading">
        Loading...
      </div>
    </div>
    <div class="repo-info">
      Visualize your Git Page history. See the
      <a href="https://github.com/javierbyte/gitpage-timemachine/">repo</a> to learn how
      to create your own.
    </div>
  </div>
</template>

<script>
import axios from "axios";
import _ from "lodash";

import Tween from "./lib/tween.js";
import Preloader from "pre-loader";

export default {
  name: "app",
  data() {
    return {
      loading: true,
      tweening: false,

      site: null,
      commits: [],

      debouncedHandleScroll: null,

      currentCommit: null,
      scrolledPercent: 0,

      debouncedSnap: null,

      _lastSnapIdx: null,
    };
  },
  methods: {
    snap() {
      if (this.tweening) {
        return;
      }

      const idx = Math.round(this.scrolledPercent / (1 / this.commits.length));

      if (idx === this._lastSnapIdx) {
        return;
      }

      this._lastSnapIdx = idx;

      document.querySelector(".screenshot-container").scrollTo({
        left: 0,
        top: Math.ceil(
          (1 / this.commits.length) *
            idx *
            (document.querySelector(".screenshot-container").scrollHeight -
              document.querySelector(".screenshot-container").clientHeight)
        ),
        behavior: "smooth",
      });
    },
    getThumbStyle(commitIndex) {
      const scrolledPercent = this.scrolledPercent;
      const position = commitIndex / this.commits.length;

      const stepThreshold = 1 / this.commits.length;

      const lowerBoundMin = scrolledPercent - stepThreshold - stepThreshold * 4;
      const lowerBoundMax = scrolledPercent - stepThreshold;

      const upperBoundMin = scrolledPercent + stepThreshold;

      // out of bounds
      if (position < lowerBoundMin || position > upperBoundMin) {
        return {
          opacity: 0,
          transform: "translatey(0) scale(1)",
        };
      }

      // perfect
      if (position >= lowerBoundMax && position <= scrolledPercent) {
        return {
          opacity: 1,
          transform: "translatey(0) scale(1)",
        };
      }

      // transition
      if (position > scrolledPercent && position <= upperBoundMin) {
        const closeness =
          1 - (position - upperBoundMin) / (scrolledPercent - upperBoundMin);

        function easeInOutQuad(t) {
          return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        }

        return {
          opacity: easeInOutQuad(1 - closeness),
          transform: "translatey(0) scale(1)",
        };
      }

      // low
      if (position >= lowerBoundMin && position < lowerBoundMax) {
        const closeness =
          1 - (position - lowerBoundMin) / (lowerBoundMax - lowerBoundMin);

        return {
          opacity: 1 - closeness,
          transform: `translatey(${-5.2 * closeness}rem) scale(${(4 - closeness) / 4})`,
        };
      }
    },
    handleScroll() {
      window.requestAnimationFrame(() => {
        if (!this.commits.length) return;

        function getScrollPercent() {
          return (
            (100 * document.querySelector(".screenshot-container").scrollTop) /
            (document.querySelector(".screenshot-container").scrollHeight -
              document.querySelector(".screenshot-container").clientHeight)
          );
        }

        const idx = Math.round(this.scrolledPercent / (1 / this.commits.length));
        const result = getScrollPercent() / 100;

        const currentIdx = Math.min(
          Math.max(Math.floor(idx), 0),
          this.commits.length - 1
        );

        this.currentCommit = this.commits[currentIdx];
        this.scrolledPercent = result;
      });

      if (this.debouncedSnap) {
        this.debouncedSnap();
      }
    },
    tweenScrollToBottom() {
      if (document.querySelector(".screenshot-container").scrollTop < 32) {
        Tween(
          {
            start: 0,
            end:
              document.querySelector(".screenshot-container").scrollHeight -
              document.querySelector(".screenshot-container").getBoundingClientRect()
                .height -
              1,
            time: 3200,
          },
          (elapsed) => {
            document.querySelector(".screenshot-container").scrollTo({
              left: 0,
              top: Math.round(elapsed),
              behavior: "auto",
            });
          }
        );
      }
    },
    loadedCommits() {
      window.onresize = function() {
        document.body.height = window.innerHeight;
        document.querySelector(".screenshot-container").style.height = window.innerHeight;
      };

      document
        .querySelector(".screenshot-container")
        .addEventListener("scroll", this.handleScroll);

      const urlArray = _.map(this.commits, (commit) => {
        return "pageData/" + commit.sha + ".jpg";
      });

      function fixScroll() {
        window.requestAnimationFrame(() => {
          const bottomScroll =
            document.querySelector(".screenshot-container").scrollHeight -
            document.querySelector(".screenshot-container").getBoundingClientRect()
              .height;

          if (document.querySelector(".screenshot-container").scrollTop < 1) {
            document.querySelector(".screenshot-container").scrollTo({
              left: 0,
              top: 1,
              behavior: "auto",
            });
          } else if (
            document.querySelector(".screenshot-container").scrollTop >=
            bottomScroll - 1
          ) {
            document.querySelector(".screenshot-container").scrollTo({
              left: 0,
              top: bottomScroll - 2,
              behavior: "auto",
            });
          }
          fixScroll();
        });
      }

      new Preloader([...urlArray.slice(0, 4), ...urlArray.slice(-4)], {
        onComplete: () => {
          this.loading = false;
          this.tweening = true;

          window.requestAnimationFrame(() => {
            this.tweenScrollToBottom();
            window.setTimeout(() => {
              fixScroll();
              this.tweening = false;
            }, 3200);
          });
        },
      });
    },
  },
  created() {
    axios
      .get("pageData/site.json")
      .then((res) => {
        this.site = _.omit(res.data, "commits");
        this.commits = _.sortBy(res.data.commits, "date").map((commit) => {
          return { ...commit, dateStr: new Date(commit.date).toLocaleDateString() };
        });
        this.currentCommit = this.commits[0];
        this.loadedCommits();
      })
      .catch((err) => {
        console.error(err);
      });
  },
  mounted() {
    this.debouncedSnap = _.debounce(this.snap, 256);
  },
  destroyed() {
    window.removeEventListener("scroll", this.handleScroll);
  },
};
</script>

<style lang="scss">
html {
  box-sizing: border-box;
}
*,
*:before,
*:after {
  box-sizing: inherit;
}

* {
  padding: 0;
  margin: 0;
  position: relative;
}

body,
html {
  background-color: #95a5a6;
  background: linear-gradient(#95a5a6, #7f8c8d);
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 300;

  height: 100vh;
  width: 100vw;

  color: #fff;
  text-shadow: rgba(0, 0, 0, 0.25) 0 -1px 0;
}

.screenshot {
  $width: 95vmin;

  position: fixed;
  top: 52%;
  left: 50%;
  width: $width;
  height: $width * 900 / 1440;
  margin-left: $width * -0.5;
  margin-top: $width * -0.5 * 900 / 1440;
  transform-origin: 50% 0%;
}

.screenshot-container {
  height: 100vh;
  overflow-y: scroll;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.screenshot-container-content {
  pointer-events: none;
}

.loading {
  text-align: center;
  top: 48vh;
  color: #ecf0f1;
}

.repo-info {
  width: 80vw;
  font-size: 0.9rem;
  position: fixed;
  top: 0;
  left: 0;
  padding: 1rem;
  z-index: 1;
}

a {
  color: #fff;
  font-weight: 500;
}

.commit-info {
  width: 100vw;

  font-size: 0.9rem;

  $infoSize: 15vmin;

  position: fixed;
  bottom: 0;
  left: 0;
  text-align: center;
  padding: 2rem 1rem;
  color: #fff;
  text-shadow: rgba(0, 0, 0, 0.25) 0 -1px 0;

  &-author {
    color: darken(#ecf0f1, 5%);
  }
}
</style>
