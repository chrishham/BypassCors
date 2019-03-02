<template lang="pug">
.container-fluid
  loading-modal(v-if="isLoading" :status="loadingStatus")
  .row
    .col-md-6.offset-md-3
      h1.mb-0 Bypass Cors
        img.ml-3.logo(src="@/assets/icon_128x128.png")
      .status
        section(v-if="serverIsUp")
          span.green.dot(title="Bypass Cors Server is up!")
          a(href='#' @click.prevent="open('http://localhost:' + runningPort)" @auxclick.prevent="") http://localhost:{{runningPort}}
          b-alert.mt-2(variant="success" show) Bypass Cors Server is up!
        section(v-else)
          span.red.dot 
          | Bypass Cors Server is down!
          b-alert.mt-2(variant="danger" v-if="errorMessage" show) {{errorMessage}}
      hr
      .settings
        h3 Change Server Settings
        label.mr-2(for="port") 
          b Port : 
        input#port(type="number" v-model="port" min="1024" max="65535")
        br
        b Are you behind a proxy ? 
        input#yesProxy.ml-2(type="radio" v-model="behindProxy" :value="true")
        label.ml-1(for='yesProxy') Yes   
        input#noProxy.ml-2(type="radio" v-model="behindProxy" :value="false")
        label.ml-1(for='noProxy') No
        section(v-if="behindProxy") 
          label(for="proxy") 
            b Proxy : 
          input#proxy.ml-2(type="text" v-model="proxy" placeholder="e.g. http://mycorporateproxy:8080") 
        label(for="whitelistDomains") 
          b Whitelist Domains 
          | (1 domain per line) : 
        br
        textarea#whitelistDomains(type="number" v-model="whitelistDomainsTextarea" placeholder="Type here the domains that are allowed to use Bypass Cors ...")
        b-button.mb-2(variant="primary" @click="restartServer" :disabled="(behindProxy && !proxy) || port<0  || port > 65535") Restart Server
        b-button.mb-2(variant="danger" @click="revertChanges") Revert Changes
</template>

<script>
// @ is an alias to /src
import { ipcRenderer } from "electron";
import LoadingModal from "@/components/LoadingModal.vue";
const opn = require("opn");

export default {
  components: { LoadingModal },
  data() {
    return {
      port: 0,
      runningPort: 0,
      whitelistDomainsTextarea: "",
      behindProxy: false,
      proxy: "",
      serverIsUp: false,
      errorMessage: "",
      isLoading: false,
      loadingStatus: ""
    };
  },
  watch: {
    port(newPort, oldPort) {
      if (newPort < 0 || newPort > 65535) {
        this.$notify({
          message: "Port has to be in the range 0 - 65535.",
          type: "danger",
          timeout: 5000,
          horizontalAlign: "center",
          verticalAlign: "top"
        });
        this.port = this.runningPort;
      }
      this.port = newPort;
    }
  },
  created() {
    let self = this;
    this.isLoading = true;
    this.loadingStatus = "Restarting server";
    // one time only: when client gets the settings for the first time
    // then start express server
    ipcRenderer.once(
      "expressServerSettings",
      (event, expressServerSettings) => {
        ipcRenderer.send("restartExpressServer", expressServerSettings);
      }
    );
    ipcRenderer.on("expressServerSettings", (event, expressServerSettings) => {
      console.log(expressServerSettings);
      let {
        port,
        behindProxy,
        proxy,
        whitelistDomains
      } = expressServerSettings;
      self.port = port;
      self.runningPort = port;
      self.behindProxy = behindProxy || false;
      self.proxy = proxy || "";
      self.whitelistDomainsTextarea = whitelistDomains.join("\n");
    });
    ipcRenderer.on("expressServerError", this.expressServerError);
    ipcRenderer.on("expressServerSuccess", this.expressServerSuccess);

    ipcRenderer.send("getExpressServerSettings");
  },
  methods: {
    restartServer() {
      this.isLoading = true;
      this.loadingStatus = "Restarting server";
      let whitelistDomains = this.whitelistDomainsTextarea
        .split("\n")
        .filter(el => el);

      ipcRenderer.send("restartExpressServer", {
        whitelistDomains,
        port: this.port,
        behindProxy: this.behindProxy,
        proxy: this.proxy
      });
    },
    revertChanges() {
      ipcRenderer.send("getExpressServerSettings");
    },
    expressServerError(event, message) {
      this.$notify({
        message,
        type: "danger",
        timeout: 5000,
        horizontalAlign: "center",
        verticalAlign: "top"
      });
      this.serverIsUp = false;
      this.errorMessage = message;
      this.isLoading = false;
    },
    expressServerSuccess(event, message) {
      this.$notify({
        message: "Server restart: Success!",
        type: "success",
        timeout: 5000,
        horizontalAlign: "center",
        verticalAlign: "top"
      });
      this.serverIsUp = true;
      this.isLoading = false;
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
  resize: none;
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
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;
  position: relative;
  top: 2px;
}

.green {
  background-color: green;
}

.red {
  background-color: red;
}
#proxy {
  width: 80%;
}
.logo {
  width: 50px;
}
</style>

