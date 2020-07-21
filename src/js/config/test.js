/*
 * App Configuration File
 * Put environment-specific global variables in this file.
 *
 * In general, if you put an variable here, you will want to
 * make sure to put an equivalent variable in all three places:
 * dev.js, stage.js & prod.js
 *
 */
(function (angular) {

  "use strict";

  try {
    angular.module("risevision.common.config");
  } catch (err) {
    angular.module("risevision.common.config", []);
  }

  // This mock disables the segment.io tracking script by
  // resetting the API key
  // angular.module("risevision.common.components.analytics")
  //   .value("SEGMENT_API_KEY", null);

  angular.module("risevision.common.i18n.config", [])
    .constant("LOCALES_PREFIX",
      "../../components/rv-common-i18n/dist/locales/translation_")
    .constant("LOCALES_SUFIX", ".json");

  angular.module("risevision.common.config")
    .value("ENABLE_INTERCOM_MESSAGING", false)
    .value("CORE_URL", "https://rvacore-test.appspot.com/_ah/api")
    .value("COOKIE_CHECK_URL", "//storage-dot-rvacore-test.appspot.com")
    .value("STORE_URL", "https://store.risevision.com")
    .value("STORE_SERVER_URL",
      "https://store-dot-rvacore-test.appspot.com")
    .value("STORE_ENDPOINT_URL",
      "https://store-dot-rvacore-test.appspot.com/_ah/api")
    .value("GSFP_URL", "https://gsfp-dot-rvaserver2.appspot.com/fp")
    .value("SUPPORT_PRODUCT_CODE", "4c8c2f1a481d0ad84c6b16a9c6e90e2fc2252944")
    .value("SUPPORT_PRODUCT_ID", "14")
    .value("SUPPORT_PRODUCT_URL",
      "https://store.risevision.com/product/14/rise-priority-support");
})(angular);
