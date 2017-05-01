<template>
  <div>
    <div class="screenshot-container" :style="{
        height: (100 + commits.length * 12) + 'vh'
      }">
      <div v-for="(commit, commitIndex) in commits">
        <img
          class="screenshot"
          :src="'pageData/' + commit.sha + '.jpg'"
          :style="getThumbStyle(commitIndex)"
          alt="" />
      </div>
    </div>

    <div class="commit-info" v-if="currentCommit">
      {{currentCommit.message}} <span class="commit-info-author">--{{currentCommit.author}} {{new Date(currentCommit.date).toLocaleDateString()}} #{{currentCommit.sha.slice(0, 7)}}</span>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import _ from 'lodash';

export default {
  name: 'app',
  data() {
    return {
      loading: true,

      site: null,
      commits: [],

      debouncedHandleScroll: null,

      currentCommit: null,
      scrolledPercent: 0
    }
  },
  methods: {
    getThumbStyle(commitIndex) {
      const scrolledPercent = this.scrolledPercent;
      const position = commitIndex / (this.commits.length);

      const stepThreshold = 1 / this.commits.length;

      const lowerBoundMin = scrolledPercent - stepThreshold - stepThreshold * 4;
      const lowerBoundMax = scrolledPercent - stepThreshold;

      const upperBoundMin = scrolledPercent + stepThreshold;


      // out of bounds
      if (position < lowerBoundMin || position > upperBoundMin) {
        return {
          opacity: 0,
          transform: 'translatey(0) scale(1)'
        };
      }

      // perfect
      if (position >= lowerBoundMax && position <= scrolledPercent) {
        return {
          opacity: 1,
          transform: 'translatey(0) scale(1)'
        };
      }

      // transition
      if (position > scrolledPercent && position <= upperBoundMin) {
        const closeness = 1 - (position - upperBoundMin) / (scrolledPercent - upperBoundMin);

        return {
          opacity: Math.pow(1 - closeness, 6),
          transform: 'translatey(0) scale(1)'
        }
      }

      // low
      if (position >= lowerBoundMin && position < lowerBoundMax) {
        const closeness = 1 - (position - lowerBoundMin) / (lowerBoundMax - lowerBoundMin);

        return {
          opacity: 1 - closeness,
          transform: `translatey(${-5.2 * closeness}rem) scale(${(4 - closeness ) / 4})`
        }
      }
    },
    handleScroll() {
      window.requestAnimationFrame(() => {
        if (!this.commits.length) return;

        function getScrollPercent() {
          var h = document.documentElement, 
              b = document.body,
              st = 'scrollTop',
              sh = 'scrollHeight';
          return (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight) * 100;
        }

        const result = Math.min(getScrollPercent() / 100, 1);
        const currentIdx = Math.min(Math.max(Math.floor(result * (this.commits.length)), 0), this.commits.length - 1);

        this.currentCommit = this.commits[currentIdx]
        this.scrolledPercent = result;
      })
    }
  },
  created() {
    axios.get('pageData/site.json').then(res => {

      this.site = _.omit(res.data, 'commits');
      this.commits = _.sortBy(res.data.commits, 'date');
      this.currentCommit = this.commits[0];

      console.log(`Rendering ${this.commits.length} commits`);

      this.loading = false;
    }).catch(err => {
      console.error(err);
    })

    window.addEventListener('scroll', this.handleScroll);
  },
  destroyed () {
    window.removeEventListener('scroll', this.handleScroll);
  }
}
</script>

<style lang="scss">
  * {
    padding: 0;
    margin: 0;
    position: relative;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 300;
    background: linear-gradient(#95A5A6, #7F8C8D);
  }

  .screenshot {
    $width: 95vmin;

    position: fixed;
    top: 52%;
    left: 50%;
    width: $width;
    height: $width * 900 / 1280;
    margin-left: $width * -0.5;
    margin-top: $width * -0.5 * 900 / 1280;
    transform-origin: 50% 0%;

  }

  .screenshot-container {
  }

  .commit-info {
    font-size: 0.9rem;

    $infoSize: 15vmin;

    height: $infoSize;
    line-height: $infoSize;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    text-align: center;
    padding: 0 1rem;
    color: #fff;
    text-shadow: darken(#7F8C8D, 10%) 0 -1px 0;

    &-author {
      color: darken(#ECF0F1, 5%);
    }
  }
</style>
