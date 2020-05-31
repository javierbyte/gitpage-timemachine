<template>
  <div class="screenshot-container">
    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div
      v-if="!loading"
      :style="{
        height: 100 + commits.length * 12 + 'vh',
      }"
    >
      <div v-for="(commit, commitIndex) in commits">
        <img
          class="screenshot"
          :src="'pageData/' + commit.sha + '.jpg'"
          :style="getThumbStyle(commitIndex)"
          alt=""
        />
      </div>

      <div class="commit-info" v-if="currentCommit">
        {{ currentCommit.message }}
        <span class="commit-info-author">
          --{{ currentCommit.author }}
          {{ new Date(currentCommit.date).toLocaleDateString() }}
          <a
            :href="`https://github.com/javierbyte/javierbyte.github.io/commit/${currentCommit.sha}`"
            >#{{ currentCommit.sha.slice(0, 7) }}</a
          >
        </span>
      </div>
    </div>

    <div class="repo-info">
      Visualize your Github Page history. See the
      <a href="https://github.com/javierbyte/gitpage-timemachine/">repo</a> to learn how
      to create your own.
    </div>
  </div>
</template>

<script>
import axios from "axios";
import _ from "lodash";

const preloader = require("pre-loader");

export default {
  name: "app",
  data() {
    return {
      loading: true,

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
      const idx = Math.round(this.scrolledPercent / (1 / this.commits.length));

      if (idx === this._lastSnapIdx) {
        return;
      }

      this._lastSnapIdx = idx;

      window.scrollTo(
        0,
        Math.ceil(
          (1 / this.commits.length) *
            idx *
            (document.body.scrollHeight - window.innerHeight)
        )
      );
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
          var h = document.documentElement,
            b = document.body,
            st = "scrollTop",
            sh = "scrollHeight";
          return ((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100;
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
      // function tryToSnap() {
      //   const objective = document.body.scrollHeight - window.innerHeight;
      //   const currentPosition = window.pageYOffset;
      //   const nextStep =
      //     Math.abs(currentPosition - objective) < 128
      //       ? objective
      //       : (objective + objective + currentPosition) / 3;

      //   if (currentPosition !== objective) {
      //     window.scrollTo(0, nextStep);
      //     window.setTimeout(tryToSnap, 200);
      //   }
      // }
      // tryToSnap();

      if (window.pageYOffset < 16) {
        const objective = document.body.scrollHeight - window.innerHeight;
        window.scrollTo(0, objective);
      }
    },
    loadedCommits() {
      window.addEventListener("scroll", this.handleScroll);

      const urlArray = _.map(this.commits, (commit) => {
        return "pageData/" + commit.sha + ".jpg";
      });

      new preloader(urlArray.slice(-5), {
        onComplete: () => {
          this.loading = false;

          window.setTimeout(() => {
            this.tweenScrollToBottom();
          }, 16);
        },
      });
    },
  },
  created() {
    axios
      .get("pageData/site.json")
      .then((res) => {
        this.site = _.omit(res.data, "commits");
        this.commits = _.sortBy(res.data.commits, "date");

        this.currentCommit = this.commits[0];

        this.loadedCommits();
      })
      .catch((err) => {
        console.error(err);
      });
  },
  mounted() {
    this.debouncedSnap = _.debounce(this.snap, 512);
  },
  destroyed() {
    window.removeEventListener("scroll", this.handleScroll);
  },
};
</script>

<style lang="scss">
html {
  box-sizing: border-box;
  scroll-behavior: smooth;
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

body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 300;
  background: linear-gradient(#95a5a6, #7f8c8d);

  min-height: 100vh;
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
