<template lang="pug">
#app
  //- #nav
  //-   router-link(to='/') Settings
  //-   |  |   
  //-   router-link(to='/about')  About
  notifications
  router-view
  Footer
</template>

<script>
import Footer from "@/components/Footer.vue";
export default {
  components: { Footer }
};
</script>

<style src="vue-notifyjs/themes/default.css"></style>
<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>
