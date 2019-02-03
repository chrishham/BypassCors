<template lang="pug">
.container-fluid
  .row
    .col-md-6.offset-md-3
      h1 Bypass Cors
      .status
        span.dot 
        a(href='#' @click.prevent="open('http://localhost:' + runningPort)") http://localhost:{{runningPort}}
        hr
      .settings
        h3 Change Server Settings
        label.mr-2(for="port") 
          b Port : 
        input#port(type="number" v-model="port" min="1025" max="65535")
        br
        label(for="whitelistDomains") 
          b Whitelist Domains 
          | (1 domain per line) : 
        br
        textarea#whitelistDomains(type="number" v-model="whitelistDomainsTextarea" placeholder="Type here the domains that can use Bypass Cors..")
        b-button.mb-2(variant="primary" @click="restartServer") Restart Server
        b-button.mb-2(variant="danger" @click="revertChanges") Revert Changes
</template>

<script>
// @ is an alias to /src
import { ipcRenderer } from "electron";
import HelloWorld from "@/components/HelloWorld.vue";
const opn = require("opn");

export default {
  name: "home",
  components: {
    HelloWorld
  },
  data() {
    return {
      port: 0,
      runningPort: 0,
      whitelistDomainsTextarea: ""
    };
  },
  mounted() {
    let self = this;
    ipcRenderer.on("expressServerSettings", (event, expressServerSettings) => {
      console.log(expressServerSettings);
      let { port, whitelistDomains } = expressServerSettings;
      self.port = port;
      self.runningPort = port;
      self.whitelistDomainsTextarea = whitelistDomains.join("\n");
    });
    ipcRenderer.send("getExpressServerSettings");
  },
  methods: {
    restartServer() {
      let whitelistDomains = this.whitelistDomainsTextarea.split("\n");

      ipcRenderer.send("restartExpressServer", {
        whitelistDomains,
        port: this.port
      });

      this.$notify({
        message: "Server restart: Success!",
        type: "success",
        timeout: 5000,
        horizontalAlign: "center",
        verticalAlign: "top"
      });
    },
    revertChanges() {
      ipcRenderer.send("getExpressServerSettings");
    },
    open(url) {
      opn(url);
    }
  }
};
</script>


<style scoped>
.container-fluid {
  margin-top: 20px;
  min-height: 85vh;
}
textarea {
  width: 100%;
  min-height: 200px;
}

.settings {
  text-align: left;
}

button {
  margin-left: 10px;
}

.dot {
  height: 15px;
  width: 15px;
  background-color: green;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;
  position: relative;
  top: 2px;
}
</style>

