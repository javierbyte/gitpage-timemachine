<template>
  <div>
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

    <div v-if="loading" class="loading">
      Loading...
    </div>

    <img
      v-if="!loading"
      v-for="(commit, commitIndex) in commits"
      :key="commit.sha"
      class="screenshot"
      :src="'pageData/' + commit.sha + '.jpg'"
      :style="getThumbStyle(commitIndex, speed)"
      alt=""
    />

    <div class="screenshot-container">
      <div
        class="screenshot-container-content"
        :style="{
          height: 100 + commits.length * 10 + 'vh',
        }"
      ></div>
    </div>

    <div class="repo-info">
      <strong>Visualize your Git Page history</strong>. See the github repo
      <a href="https://github.com/javierbyte/gitpage-timemachine/"
        >javierbyte/gitpage-timemachine</a
      >
      to learn how to create your own.
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

      _debouncedSnap: () => {},

      currentCommit: null,
      currentIdx: 0,
      speed: 0,
      lastScrollPosition: 0,
      scrolledPercent: 0,

      snapped: false,
    };
  },
  methods: {
    getThumbStyle(commitIndex) {
      const scrolledPercent = this.scrolledPercent;
      const position = commitIndex / (this.commits.length - 1);

      const stepThreshold = 1 / (this.commits.length - 1);

      const lowerBoundMin = scrolledPercent - stepThreshold * 6;
      const lowerBoundMax = scrolledPercent - stepThreshold;

      const upperBoundMin = scrolledPercent + stepThreshold;

      // out of bounds
      if (position < lowerBoundMin || position > upperBoundMin) {
        return {
          display: "none",
          opacity: 0,
          transform: "translatey(0) scale(1)",
        };
      }

      // perfect
      if (position >= lowerBoundMax && position <= scrolledPercent) {
        return {
          opacity: 1,
          transform: "translatey(0) scale(1)",
          boxShadow: "rgba(0,0,0,0.05) 0 0 0 2px",
        };
      }

      // transition
      if (position > scrolledPercent && position <= upperBoundMin) {
        const closeness =
          1 - (position - upperBoundMin) / (scrolledPercent - upperBoundMin);

        return {
          transition: this.snapped ? "opacity 0.4s" : "none",
          opacity: this.snapped ? (1 - closeness > 0.5 ? 1 : 0) : 1 - closeness,
          transform: "translatey(0) scale(1)",
        };
      }

      // low
      if (position >= lowerBoundMin && position < lowerBoundMax) {
        const closeness =
          1 - (position - lowerBoundMin) / (lowerBoundMax - lowerBoundMin);

        return {
          opacity: Math.pow(1 - closeness, 1.5),
          transform: `translatey(${(2 + this.speed) *
            -80 *
            Math.pow(closeness, 0.9)}px) scale(${1 - Math.pow(closeness, 1.5) / 3})`,
        };
      }
    },
    handleScroll() {
      const scrollPosition =
        document.querySelector(".screenshot-container").scrollTop || 0;

      if (!this.lastScrollPosition) {
        this.lastScrollPosition = 0;
      }

      if (!this.speed) {
        this.speed = 0;
      }
      const distance = Math.abs(this.lastScrollPosition - scrollPosition);

      this.speed =
        (Math.pow(1 + (this.speed + distance) / 2, 0.25) + this.speed * 12 - 1) / 13;

      if (this.speed < 0.01) this.speed = 0;

      this.lastScrollPosition = scrollPosition;

      window.requestAnimationFrame(() => {
        if (!this.commits.length) return;

        function getScrollPercent() {
          return (
            scrollPosition /
            (document.querySelector(".screenshot-container").scrollHeight -
              document.querySelector(".screenshot-container").clientHeight)
          );
        }

        const scrollPercent = getScrollPercent();
        const idx = Math.round(scrollPercent * (this.commits.length - 1));

        const currentIdx = Math.min(Math.max(idx, 0), this.commits.length);

        this.currentIdx = currentIdx;
        this.currentCommit = this.commits[currentIdx];
        this.scrolledPercent = scrollPercent;
      });
    },
    animateScroll() {
      window.requestAnimationFrame(() => {
        this.handleScroll();
        this.animateScroll();
      });
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
      const vueEl = this;

      window.onresize = function() {
        document.body.height = `${window.innerHeight}px`;
        document.querySelector(
          ".screenshot-container"
        ).style.height = `${window.innerHeight}px`;
      };
      document.body.height = `${window.innerHeight}px`;
      document.querySelector(
        ".screenshot-container"
      ).style.height = `${window.innerHeight}px`;

      // document
      //   .querySelector(".screenshot-container")
      //   .addEventListener("scroll", this.handleScroll);

      document.querySelector(".screenshot-container").addEventListener("scroll", () => {
        this.snapped = false;
        this._debouncedSnap();
      });

      this.animateScroll();

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
    this._debouncedSnap = _.debounce(
      () => {
        this.snapped = true;
      },
      256,
      {
        leading: false,
      }
    );

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
}

body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
  border-radius: 3px;
}

.screenshot-container {
  width: 100vw;
  overflow-y: scroll;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  transform: translatex(0);
}

.screenshot-container-content {
  width: 100vw;
  transform: translatex(0);
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
