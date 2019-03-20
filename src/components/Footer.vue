  <template lang="pug">
  section#footer
    .container
      .row
        .col-xs-12.col-sm-12.col-md-12.mt-2.mt-sm-2.text-center
          p.h6 An 
            a(href="#" @click="open('https://electronjs.org/')" ) Electron 
            | app, created with ❤️ by 
            | Christopher Chamaletsos .
            br
            a(href="#" @click="open('https://github.com/chrishham/BypassCors/blob/master/LICENSE')") MIT
            |  license.
            span  Hosted at 
              a(href="#" @click="open('https://github.com/chrishham/BypassCors')")
                img.githubIcon(src="@/assets/GitHub-Mark-32px.png" alt="Github Icon" class="githubIcon")
              |  .
  </template>
  
<script>
const opn = require("opn");
export default {
  computed: {
    date() {
      return new Date().getFullYear();
    }
  },
  methods: {
    open(url) {
      opn(url);
    }
  }
};
</script>

<style scoped>
.githubIcon {
  width: 25px;
}
</style>
