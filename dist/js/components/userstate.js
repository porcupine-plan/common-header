(function (angular) {
  "use strict";

  try {
    angular.module("risevision.common.config");
  } catch (err) {
    angular.module("risevision.common.config", []);
  }

  angular.module("risevision.common.config")
    .value("ENABLE_EXTERNAL_LOGGING", true)
    .value("CORE_URL", "https://rvaserver2.appspot.com/_ah/api");

  angular.module("risevision.common.components.logging", []);

  angular.module("risevision.common.components.rvtokenstore", [
    "risevision.common.components.util", "LocalStorageModule",
    "ngCookies"
  ]);

  angular.module("risevision.common.components.userstate", [
    "ui.router",
    "angular-md5",
    "risevision.common.components.ui-flow",
    "risevision.common.components.util",
    "risevision.common.components.rvtokenstore",
    "risevision.common.components.logging",
    "risevision.common.components.loading",
    "risevision.common.config",
    "risevision.common.gapi", "LocalStorageModule",
    "risevision.core.cache",
    "risevision.core.oauth2", "risevision.core.company",
    "risevision.core.util", "risevision.core.userprofile"
  ])

  // Set up our mappings between URLs, templates, and controllers
  .config(["$urlRouterProvider", "$urlMatcherFactoryProvider", "$stateProvider", "$locationProvider",
    function storeRouteConfig($urlRouterProvider, $urlMatcherFactoryProvider, $stateProvider,
      $locationProvider) {

      $locationProvider.html5Mode(true);
      $locationProvider.hashPrefix("/");

      $urlRouterProvider
        .when(/\/.*&id_token=.*&client_id=.*/, function () {
          console.log("Google Auth result received");
        })
        .when("/", ["$location",
          function ($location) {
            var hash = $location.hash();

            if (hash && hash.match(/\/.*&id_token=.*&client_id=.*/)) {
              console.log("Google Auth result received");
            } else {
              return false;
            }
          }
        ])
        .otherwise("/");

      // https://stackoverflow.com/questions/24420578/handling-trailing-slashes-in-angularui-router
      $urlMatcherFactoryProvider.strictMode(false);

      // Use $stateProvider to configure states.
      $stateProvider.state("common", {
        template: "<div class=\"app-launcher\" ui-view></div>"
      })

      .state("common.auth", {
        abstract: true,
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get("userstate/auth-common.html");
          }
        ]
      })

      .state("common.auth.unauthorized", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get("userstate/login.html");
          }
        ],
        url: "/unauthorized/:state",
        controller: "LoginCtrl",
        params: {
          isSignUp: false,
          passwordReset: null,
          accountConfirmed: null
        }
      })

      .state("common.auth.createaccount", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get("userstate/create-account.html");
          }
        ],
        url: "/createaccount/:state",
        controller: "LoginCtrl",
        params: {
          isSignUp: true,
          joinAccount: false
        }
      })

      .state("common.auth.joinaccount", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get("userstate/create-account.html");
          }
        ],
        url: "/joinaccount/:companyName",
        controller: "LoginCtrl",
        params: {
          isSignUp: true,
          joinAccount: true
        }
      })

      .state("common.auth.confirmaccount", {
        controller: "ConfirmAccountCtrl",
        template: "<div ui-view></div>",
        url: "/confirmaccount/:user/:token"
      })

      .state("common.auth.requestconfirmationemail", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get(
              "userstate/request-confirmation-email.html");
          }
        ],
        url: "/requestconfirmationemail",
        controller: "RequestConfirmationEmailCtrl"
      })

      .state("common.auth.requestpasswordreset", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get(
              "userstate/request-password-reset.html");
          }
        ],
        url: "/requestpasswordreset",
        controller: "RequestPasswordResetCtrl"
      })

      .state("common.auth.resetpassword", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get(
              "userstate/reset-password-confirm.html");
          }
        ],
        url: "/resetpassword/:user/:token",
        controller: "ResetPasswordConfirmCtrl"
      })

      .state("common.auth.unsubscribe", {
        templateProvider: ["$templateCache",
          function ($templateCache) {
            return $templateCache.get("userstate/unsubscribe.html");
          }
        ],
        url: "/unsubscribe",
        controller: ["$scope", "$location",
          function ($scope, $location) {
            var params = $location.path("/unsubscribe").search();
            $scope.email = params.email;
            $scope.id = params.id;
            $scope.name = params.name;
          }
        ]
      });
    }
  ])

  .run(["$rootScope", "$state", "$stateParams", "urlStateService",
    "userState",
    function ($rootScope, $state, $stateParams, urlStateService, userState) {
      userState._restoreState();

      $rootScope.$on("$stateChangeStart", function (event, toState,
        toParams, fromState, fromParams) {
        if (toState && (
          toState.name === "common.auth.unauthorized" ||
          toState.name === "common.auth.unregistered" ||
          toState.name === "common.auth.createaccount") && !toParams.state) {

          if (fromParams.state) {
            toParams.state = fromParams.state;

            event.preventDefault();

            $state.go(toState.name, toParams);
          }
        }
      });

      $rootScope.$on("risevision.user.authorized", function () {
        var currentState = $state.current.name;

        if (currentState.indexOf("common.auth") !== -1 && currentState !== "common.auth.unsubscribe") {
          urlStateService.redirectToState($stateParams.state);
        }
      });
    }
  ]);

})(angular);

"use strict";

angular.module("risevision.common.components.userstate")
  .factory("canAccessApps", ["$q", "$state", "$location",
    "userState", "userAuthFactory", "urlStateService",
    function ($q, $state, $location, userState, userAuthFactory,
      urlStateService) {
      return function (signup, allowReturn) {
        var deferred = $q.defer();
        userAuthFactory.authenticate(false)
          .then(function () {
            if (userState.isRiseVisionUser()) {
              deferred.resolve();
            } else {
              return $q.reject();
            }
          })
          .then(null, function () {
            var newState;

            if (!userState.isLoggedIn()) {
              if (signup) {
                newState = "common.auth.createaccount";
              } else {
                newState = "common.auth.unauthorized";
              }
            } else if ($state.get("common.auth.unregistered")) {
              newState = "common.auth.unregistered";
            }

            if (newState) {
              $state.go(newState, {
                state: urlStateService.get()
              }, {
                reload: true
              });

              if (!allowReturn) {
                $location.replace();
              }

              deferred.reject();
            } else {
              deferred.resolve();
            }
          });
        return deferred.promise;
      };
    }
  ]);

"use strict";

angular.module("risevision.common.components.logging")
  .factory("bigQueryLogging", ["externalLogging", "userState",
    function (externalLogging, userState) {
      var factory = {};

      factory.logEvent = function (eventName, eventDetails, eventValue,
        username, companyId) {
        return externalLogging.logEvent(eventName, eventDetails, eventValue,
          username || userState.getUsername(), companyId || userState.getSelectedCompanyId()
        );
      };

      return factory;
    }
  ]);

(function (angular) {

  "use strict";

  angular.module("risevision.common.components.userstate")
    .factory("companyState", ["$location", "getCompany", "objectHelper",
      "$rootScope", "$log", "$q",
      function ($location, getCompany, objectHelper, $rootScope, $log, $q) {
        var pendingSelectedCompany;

        var _state = {
          userCompany: {},
          selectedCompany: {}
        };

        var _resetCompanyState = function () {
          objectHelper.clearObj(_state.selectedCompany);
          objectHelper.clearObj(_state.userCompany);
          $log.debug("Company state has been reset.");
        };

        if ($location.search().cid) {
          $log.debug("cid", $location.search().cid,
            "saved for later processing.");
          pendingSelectedCompany = $location.search().cid;
        }

        var _init = function () {
          var deferred = $q.defer();

          //populate userCompany
          getCompany().then(function (company) {
            var selectedCompanyId = _companyState.getSelectedCompanyId() ?
              _companyState.getSelectedCompanyId() :
              pendingSelectedCompany;

            objectHelper.clearAndCopy(company, _state.userCompany);

            return _switchCompany(selectedCompanyId);
          })
            .then(null, function () {
              _companyState.resetCompany();
            })
            .finally(function () {
              pendingSelectedCompany = null;

              deferred.resolve(null);
            });

          return deferred.promise;
        };

        var _switchCompany = function (companyId) {
          var deferred = $q.defer();

          if (companyId && companyId !== _state.userCompany.id) {
            getCompany(companyId)
              .then(function (company) {
                objectHelper.clearAndCopy(company, _state.selectedCompany);

                deferred.resolve();
                $rootScope.$broadcast(
                  "risevision.company.selectedCompanyChanged");
              })
              .then(null, function (resp) {
                console.error("Failed to load selected company.", resp);

                deferred.reject(resp);
              });
          } else {
            _companyState.resetCompany();

            deferred.resolve();
          }

          return deferred.promise;
        };

        var _reloadSelectedCompany = function () {
          var deferred = $q.defer();

          getCompany(_state.selectedCompany.id)
            .then(function (company) {
              objectHelper.clearAndCopy(company, _state.selectedCompany);

              deferred.resolve();
              $rootScope.$broadcast("risevision.company.updated", {
                "companyId": company.id
              });
            })
            .then(null, function (resp) {
              console.error("Failed to reload selected company.", resp);

              deferred.reject(resp);
            });

          return deferred.promise;
        };

        var _companyState = {
          init: _init,
          switchCompany: _switchCompany,
          reloadSelectedCompany: _reloadSelectedCompany,
          updateCompanySettings: function (company) {
            if (company && company.id === _companyState.getSelectedCompanyId()) {
              objectHelper.clearAndCopy(company, _state.selectedCompany);
            }
            if (company && company.id === _companyState.getUserCompanyId()) {
              objectHelper.clearAndCopy(company, _state.userCompany);
            }

            $rootScope.$broadcast("risevision.company.updated", {
              "companyId": company.id
            });
          },
          resetCompany: function () {
            objectHelper.clearAndCopy(_state.userCompany, _state.selectedCompany);

            $rootScope.$broadcast(
              "risevision.company.selectedCompanyChanged");
          },
          resetCompanyState: _resetCompanyState,
          getUserCompanyId: function () {
            return (_state.userCompany && _state.userCompany.id) || null;
          },
          getUserCompanyName: function () {
            return (_state.userCompany && _state.userCompany.name) ||
              null;
          },
          getSelectedCompanyId: function () {
            return (_state.selectedCompany && _state.selectedCompany.id) ||
              null;
          },
          getSelectedCompanyName: function () {
            return (_state.selectedCompany && _state.selectedCompany.name) ||
              null;
          },
          getSelectedCompanyCountry: function () {
            return (_state.selectedCompany && _state.selectedCompany.country) ||
              null;
          },
          getCopyOfUserCompany: function (noFollow) {
            if (noFollow) {
              return angular.extend({}, _state.userCompany);
            } else {
              return objectHelper.follow(_state.userCompany);
            }
          },
          getCopyOfSelectedCompany: function (noFollow) {
            if (noFollow) {
              return angular.extend({}, _state.selectedCompany);
            } else {
              return objectHelper.follow(_state.selectedCompany);
            }
          },
          isSubcompanySelected: function () {
            return _state.selectedCompany && _state.selectedCompany.id !==
              (_state.userCompany && _state.userCompany.id);
          },
          isTestCompanySelected: function () {
            return _state.selectedCompany && _state.selectedCompany.isTest ===
              true;
          },
          isSeller: function () {
            return (_state.selectedCompany && _state.selectedCompany.sellerId) ?
              true : false;
          },
          isRootCompany: function () {
            return _state.userCompany && !_state.userCompany.parentId;
          },
          isSelectedCompanyChargebee: function () {
            return _state.selectedCompany && _state.selectedCompany.origin === "Chargebee";
          },
          isEducationCustomer: function () {
            return _state.selectedCompany && (_state.selectedCompany.companyIndustry ===
              "PRIMARY_SECONDARY_EDUCATION" || _state.selectedCompany.companyIndustry === "HIGHER_EDUCATION");
          }
        };

        return _companyState;
      }
    ]);

})(angular);

(function (angular) {
  "use strict";

  angular.module("risevision.common.components.userstate")
    .factory("customAuthFactory", ["$q", "$log", "gapiLoader",
      "userauth", "userState",
      function ($q, $log, gapiLoader, userauth, userState) {
        var factory = {};

        factory.authenticate = function (credentials) {
          var deferred = $q.defer();
          var _state = userState._state;

          if (credentials && credentials.username && credentials.password) {
            $q.all([gapiLoader(), userauth.login(credentials.username,
              credentials.password)])
              .then(function (result) {
                var gApi = result[0];
                var loginInfo = result[1] && result[1].result;

                $log.debug("JWT login result:", loginInfo);
                if (loginInfo && loginInfo.item) {
                  var token = {
                    access_token: loginInfo.item,
                    expires_in: "3600",
                    token_type: "Bearer"
                  };
                  gApi.auth.setToken(token);

                  deferred.resolve({
                    email: credentials.username,
                    token: token
                  });
                } else {
                  deferred.reject("Invalid Auth Token (JWT)");
                }
              })
              .then(null, function (err) {
                deferred.reject(err);
              });
          } else if (_state.userToken && _state.userToken.token) {
            gapiLoader().then(function (gApi) {
              gApi.auth.setToken(_state.userToken.token);

              // TODO: Validate token?

              deferred.resolve(_state.userToken);
            });
          } else {
            deferred.reject();
          }

          return deferred.promise;
        };

        factory.addUser = function (credentials) {
          var deferred = $q.defer();

          if (credentials && credentials.username && credentials.password) {
            userauth.add(credentials.username, credentials.password)
              .then(function (result) {
                deferred.resolve(result);
              })
              .then(null, function () {
                deferred.reject();
              });
          } else {
            deferred.reject();
          }

          return deferred.promise;
        };

        return factory;
      }
    ]);

})(angular);

"use strict";

/*jshint camelcase: false */

angular.module("risevision.common.components.logging")
  .constant("EXTERNAL_LOGGER_SERVICE_URL",
    "https://www.googleapis.com/bigquery/v2/projects/client-side-events/datasets/Apps_Events/tables/TABLE_ID/insertAll"
)
  .constant("EXTERNAL_LOGGER_REFRESH_URL",
    "https://www.googleapis.com/oauth2/v3/token?" +
    "client_id=1088527147109-6q1o2vtihn34292pjt4ckhmhck0rk0o7.apps.googleusercontent.com&" +
    "client_secret=nlZyrcPLg6oEwO9f9Wfn29Wh&refresh_token=1/xzt4kwzE1H7W9VnKB8cAaCx6zb4Es4nKEoqaYHdTD15IgOrJDtdun6zK6XiATCKT&" +
    "grant_type=refresh_token"
)
  .factory("externalLogging", ["$http", "$window", "$q", "$log",
    "EXTERNAL_LOGGER_REFRESH_URL", "EXTERNAL_LOGGER_SERVICE_URL",
    "ENABLE_EXTERNAL_LOGGING",
    function ($http, $window, $q, $log, EXTERNAL_LOGGER_REFRESH_URL,
      EXTERNAL_LOGGER_SERVICE_URL, ENABLE_EXTERNAL_LOGGING) {
      var factory = {};

      var _getSuffix = function () {
        var date = new Date();
        var year = date.getUTCFullYear();
        var month = date.getUTCMonth() + 1;
        var day = date.getUTCDate();
        if (month < 10) {
          month = "0" + month;
        }
        if (day < 10) {
          day = "0" + day;
        }
        return year.toString() + month.toString() + day.toString();
      };

      var EXTERNAL_LOGGER_INSERT_SCHEMA = {
        "kind": "bigquery#tableDataInsertAllRequest",
        "skipInvalidRows": false,
        "ignoreUnknownValues": false,
        "templateSuffix": _getSuffix(),
        "rows": [{
          "insertId": "",
          "json": {
            "event": "",
            "event_details": "",
            "event_value": 0,
            "host": "",
            "ts": 0,
            "user_id": "",
            "company_id": ""
          }
        }]
      };

      var _token, _tokenRefreshedAt;

      factory.logEvent = function (eventName, eventDetails, eventValue,
        userId, companyId) {
        $log.debug("BQ log", eventName, eventDetails, eventValue, userId,
          companyId);

        if (ENABLE_EXTERNAL_LOGGING === false) {
          $log.debug("External Logging DISABLED");
          return;
        }

        var deferred = $q.defer();

        factory.getToken().then(function (token) {
          var insertData = JSON.parse(JSON.stringify(
            EXTERNAL_LOGGER_INSERT_SCHEMA));
          var serviceUrl = EXTERNAL_LOGGER_SERVICE_URL.replace("TABLE_ID",
            "apps_events");

          insertData.rows[0].insertId = Math.random().toString(36).substr(2)
            .toUpperCase();
          insertData.rows[0].json.event = eventName;
          if (eventDetails) {
            insertData.rows[0].json.event_details = eventDetails;
          }
          if (eventValue) {
            insertData.rows[0].json.event_value = eventValue;
          }
          insertData.rows[0].json.user_id = userId || "";
          insertData.rows[0].json.company_id = companyId || "";
          insertData.rows[0].json.host = $window.location.hostname;
          insertData.rows[0].json.ts = new Date().toISOString();

          $http.post(serviceUrl, insertData, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
            }
          }).then(function (result) {
            deferred.resolve(result);
          }, function (error) {
            $log.debug("error posting to BQ", error);
            deferred.reject(error);
          });
        }, function (error) {
          $log.debug("BQ token ERROR", error);
          deferred.reject(error);
        });

        return deferred.promise;
      };

      factory.getToken = function () {
        var deferred = $q.defer();
        if (_token && new Date().getTime() - _tokenRefreshedAt < 3580000) {
          deferred.resolve(_token);
        } else {
          $http.post(EXTERNAL_LOGGER_REFRESH_URL).then(function (resp) {
            _token = resp.data.access_token;
            _tokenRefreshedAt = new Date().getTime();
            deferred.resolve(resp.data.access_token);
          }, function () {
            deferred.reject();
          });
        }
        return deferred.promise;
      };

      return factory;
    }
  ]);

(function (angular) {
  "use strict";

  /*jshint camelcase: false */

  angular.module("risevision.common.components.userstate")
  // constants (you can override them in your app as needed)
  .factory("googleAuthFactory", ["$rootScope", "$q", "$log", "$window",
    "$stateParams", "auth2APILoader", "getOAuthUserInfo", "uiFlowManager",
    "userState", "urlStateService",
    function ($rootScope, $q, $log, $window, $stateParams, auth2APILoader,
      getOAuthUserInfo, uiFlowManager, userState, urlStateService) {

      var _gapiAuthorize = function () {
        var deferred = $q.defer();

        auth2APILoader()
          .then(function (auth2) {
            var authResult = auth2.getAuthInstance() &&
              auth2.getAuthInstance().isSignedIn.get();

            $log.debug("auth2.isSignedIn result:", authResult);
            if (authResult) {
              deferred.resolve(authResult);
            } else {
              deferred.reject("Failed to authorize user (auth2)");
            }
          })
          .then(null, deferred.reject); //auth2APILoader

        return deferred.promise;
      };

      /*
       * Responsible for triggering the Google OAuth process.
       *
       */
      var authenticate = function () {
        var deferred = $q.defer();

        _gapiAuthorize()
          .then(getOAuthUserInfo)
          .then(function (oauthUserInfo) {
            if (userState._state.redirectState) {
              urlStateService.redirectToState(userState._state.redirectState);

              delete userState._state.redirectState;
            }

            deferred.resolve(oauthUserInfo);
          })
          .then(null, function (err) {
            deferred.reject(err);
          });

        return deferred.promise;
      };

      var _isPopupAuth = function () {
        return (userState._state.inRVAFrame || ($window.self !== $window.top));
      };

      var forceAuthenticate = function () {
        var deferred = $q.defer();
        var loc;
        var redirectState = $stateParams.state;

        // Redirect to full URL path
        if ($rootScope.redirectToRoot === false) {
          loc = $window.location.href.substr(0, $window.location.href
            .indexOf("#")) || $window.location.href;

          redirectState = urlStateService.clearStatePath(redirectState);
        } else {
          loc = $window.location.origin + "/";
        }

        userState._state.redirectState = redirectState;
        userState._persistState();
        uiFlowManager.persist();

        var opts = {
          response_type: "token",
          prompt: "select_account",
          ux_mode: _isPopupAuth() ? "popup" : "redirect",
          redirect_uri: loc
        };

        auth2APILoader()
          .then(function (auth2) {
            return auth2.getAuthInstance().signIn(opts);
          })
          .then(function () {
            if (_isPopupAuth()) {
              deferred.resolve(authenticate());
            } else {
              deferred.resolve();
            }
          })
          .then(null, function (err) {
            deferred.reject(err);
          });

        return deferred.promise;
      };

      var googleAuthFactory = {
        authenticate: function (forceAuth) {
          if (!forceAuth) {
            return authenticate();
          } else {
            return forceAuthenticate();
          }
        }
      };

      return googleAuthFactory;
    }
  ]);

})(angular);

(function (angular) {
  "use strict";

  angular.module("risevision.common.components.rvtokenstore")
    .value("TOKEN_STORE_KEY", "rv-auth-object")
    .service("rvTokenStore", ["$log", "$location", "$cookies",
      "getBaseDomain", "TOKEN_STORE_KEY",
      function ($log, $location, $cookies, getBaseDomain,
        TOKEN_STORE_KEY) {
        var _readRvToken = function () {
          var token = $cookies.get(TOKEN_STORE_KEY);

          try {
            return JSON.parse(token);
          } catch (e) {
            return token;
          }
        };

        var _writeRvToken = function (value) {
          var baseDomain = getBaseDomain();
          if (baseDomain === "localhost") {
            $cookies.put(TOKEN_STORE_KEY, JSON.stringify(value), {
              path: "/"
            });
          } else {
            $cookies.put(TOKEN_STORE_KEY, JSON.stringify(value), {
              domain: baseDomain,
              path: "/"
            });
          }
        };

        var _clearRvToken = function () {
          var baseDomain = getBaseDomain();
          if (baseDomain === "localhost") {
            $cookies.remove(TOKEN_STORE_KEY, {
              path: "/"
            });
          } else {
            $cookies.remove(TOKEN_STORE_KEY, {
              domain: baseDomain,
              path: "/"
            });
          }
        };

        var rvToken = {
          read: _readRvToken,
          write: _writeRvToken,
          clear: _clearRvToken
        };

        return rvToken;
      }
    ]);

})(angular);

(function (angular) {

  "use strict";

  angular.module("risevision.common.components.userstate")

  .run(["$rootScope", "userState", "selectedCompanyUrlHandler",
    function ($rootScope, userState, selectedCompanyUrlHandler) {
      $rootScope.$on("risevision.company.selectedCompanyChanged",
        function (newCompanyId) {
          if (newCompanyId) {
            selectedCompanyUrlHandler.updateUrl();
          }
        });

      //detect selectCompany changes on route UI
      $rootScope.$on("$stateChangeSuccess", selectedCompanyUrlHandler.updateSelectedCompanyFromUrl);
      $rootScope.$on("$routeChangeSuccess", selectedCompanyUrlHandler.updateSelectedCompanyFromUrl);
      $rootScope.$on("$locationChangeSuccess", selectedCompanyUrlHandler.locationChangeSuccess);
    }
  ])

  .service("selectedCompanyUrlHandler", ["$state", "$stateParams",
    "$location", "userState",
    function ($state, $stateParams, $location, userState) {
      // Called when the selectedCompanyId is changed
      this.updateUrl = function () {
        var selectedCompanyId = userState.getSelectedCompanyId();
        // This parameter is only appended to the url if the user is logged in
        // Do not apply during $state.trasition (handler will)
        if (selectedCompanyId && $location.search().cid !==
          selectedCompanyId && !$state.transition) {
          $stateParams.cid = selectedCompanyId;
          $state.params.cid = selectedCompanyId;

          $location.search("cid", selectedCompanyId);
        }
      };

      this.updateSelectedCompanyFromUrl = function () {
        var newCompanyId = $location.search().cid;

        if (newCompanyId && userState.getUserCompanyId() &&
          newCompanyId !== userState.getSelectedCompanyId()) {
          // The CID is changed in the URL; switch company
          userState.switchCompany(newCompanyId);
        } else if (!newCompanyId && userState.getSelectedCompanyId()) {
          // The CID is missing in the URL; add it
          var currentURL = $location.absUrl();

          $stateParams.cid = userState.getSelectedCompanyId();
          $state.params.cid = userState.getSelectedCompanyId();

          $location.search("cid", userState.getSelectedCompanyId());
          if (currentURL === $location.destUrl) {
            // see explanation below
            $location.replace();
          }
        }
      };

      this.locationChangeSuccess = function (event, newUrl) {
        $location.destUrl = newUrl;
      };

      /*

      Explanation for the usage of the $location.replace() above
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

      Scenario 1: When application is using "ng-href" directive, then application goes through the following cycle

        $locationChangeSuccess -> $stateChangeSuccess -> $locationChangeSuccess

      Scenario 2: When application is using "ui-sref" directive or "$state.go" funtion, then application goes through the following cycle

        $stateChangeSuccess -> $locationChangeSuccess

      Here is the dilemma:
      - without $location.replace(), scenarion #2 works as expected creating single entries in the browser navigation history, 
      however scenario #1 creates duplicate entries - one URL without "cid" parameter and with "cid".
      - with $location.replace(), scenarion #2 does not add any entries to the browser navigation history, 
      however scenario #1 works as expected.
      
      The solution is to monitor $locationChangeSuccess events and record "newUrl" parameter, then use it in $stateChangeSuccess event
      in order to detect if pattern falls under scenario 1 or 2 then call $location.replace() based on that condition.

      */

    }
  ]);
})(angular);

(function (angular) {
  "use strict";

  angular.module("risevision.common.components.userstate")
    .factory("urlStateService", ["$window", "$location", "userState",
      function ($window, $location, userState) {

        var urlStateService = {};

        urlStateService.get = function () {
          var state = "";
          var stateObject = {
            p: null,
            u: null,
            s: null
          };

          // Redirect to the URL root and append pathname back to the URL
          // on Authentication success
          // This prevents Domain authentication errors for sub-folders
          // Warning: Root folder must have CH available for this to work,
          // otherwise no redirect is performed!
          // loc = $window.location.origin + "/";
          // Remove first character (/) from path since we're adding it to loc
          stateObject.p = $window.location.pathname ? $window.location
            .pathname
            .substring(1) : "";
          stateObject.s = $window.location.search;
          stateObject.u = $window.location.hash;

          if (stateObject.p || stateObject.s || stateObject.u) {
            state = encodeURIComponent(JSON.stringify(stateObject));
          }

          return state;
        };

        var _parseState = function (stateString) {
          var state = {};

          try {
            state = JSON.parse(decodeURIComponent(stateString));
          } catch (err) {
            // Parse failed
          }

          return state;
        };

        urlStateService.redirectToState = function (stateString) {
          var state = _parseState(stateString);

          if (state.u || !$location.$$html5) { // hash found, assume non HTML5 mode
            if (state.p || state.s) { // requires redirect
              userState._persistState();

              $window.location.replace(state.p +
                state.s +
                state.u
              );
            } else {
              $window.location.hash = state.u;
            }
          } else { // HTML5 mode
            state.p = state.p || "/";
            state.s = state.s || "";
            $location.url(state.p + state.s);
            $location.replace();
          }
        };

        urlStateService.clearStatePath = function (stateString) {
          var state = _parseState(stateString);

          state.p = undefined;
          state.s = undefined;

          return encodeURIComponent(JSON.stringify(state));
        };

        urlStateService.getUrlParam = function (paramName) {
          // if page is reloaded, then you can get param from $location.search()
          // otherwise you need to parse $location.path()

          if ($location.search()[paramName]) {
            return $location.search()[paramName];
          } else {
            var decodedPath = decodeURIComponent(decodeURIComponent(decodeURIComponent(decodeURIComponent($location
              .path()))));
            var match = new RegExp("[\?&]" + paramName + "=([^&#\"]*)").exec(decodedPath);
            return match && match[1];
          }
        };

        return urlStateService;
      }
    ]);

})(angular);

(function (angular) {
  "use strict";

  angular.module("risevision.common.components.userstate")
    .value("FORCE_GOOGLE_AUTH", false)
    .factory("userAuthFactory", ["$q", "$log", "$location",
      "$rootScope", "$loading", "$window", "$document",
      "auth2APILoader", "objectHelper", "rvTokenStore", "externalLogging",
      "userState", "googleAuthFactory", "customAuthFactory",
      "FORCE_GOOGLE_AUTH",
      function ($q, $log, $location, $rootScope, $loading, $window,
        $document, auth2APILoader, objectHelper,
        rvTokenStore, externalLogging, userState, googleAuthFactory,
        customAuthFactory, FORCE_GOOGLE_AUTH) {

        var _state = userState._state;

        var _authorizeDeferred, _authenticateDeferred;

        var _shouldLogPageLoad = true;

        var _logPageLoad = function (details) {
          if (_shouldLogPageLoad) {
            _shouldLogPageLoad = false;
            try {
              var duration = new Date().getTime() - $window.performance
                .timing.navigationStart;
              externalLogging.logEvent("page load time", details,
                duration,
                userState.getUsername(), userState.getSelectedCompanyId()
              );
            } catch (e) {
              $log.debug("Error logging load time");
            }
          }
        };

        var _setUserToken = function (userToken) {
          _state.userToken = userToken;
          rvTokenStore.write(_state.userToken);
        };

        var _cancelAccessTokenAutoRefresh = function () {};

        var _resetUserState = function () {
          $log.debug("Clearing user token...");
          _cancelAccessTokenAutoRefresh();
          delete _state.userToken;
          rvTokenStore.clear();

          userState._resetState();
        };

        var _detectUserOrAuthChange = function () {
          var token = rvTokenStore.read();
          if (!angular.equals(token, _state.userToken)) {
            $log.error("Authentication Failed. User token no longer matches stored token.");

            //token change indicates that user either signed in, or signed out, or changed account in other app
            $window.location.reload();
          } else if (_state.userToken) {
            _authenticateDeferred = null;

            //make sure user is not signed out of Google account outside of the CH enabled apps
            authenticate(false).finally(function () {
              if (!_state.userToken) {
                $log.error("Authentication Failed. User no longer signed in.");

                $window.location.reload();
              }
            });
          }
        };

        var _visibilityListener = function () {
          var visibilityState;
          var document = $document[0];
          if (typeof document.hidden !== "undefined") {
            visibilityState = "visibilityState";
          } else if (typeof document.mozHidden !== "undefined") {
            visibilityState = "mozVisibilityState";
          } else if (typeof document.msHidden !== "undefined") {
            visibilityState = "msVisibilityState";
          } else if (typeof document.webkitHidden !== "undefined") {
            visibilityState = "webkitVisibilityState";
          }
          $log.debug("visibility: " + document[visibilityState]);
          if ("visible" === document[visibilityState]) {
            _detectUserOrAuthChange();
            $rootScope.$broadcast("risevision.page.visible", true);
          }
        };

        var _getVisibilityChangeName = function () {
          var visibilityChange;
          var document = $document[0];
          if (typeof document.hidden !== "undefined") {
            visibilityChange = "visibilitychange";
          } else if (typeof document.mozHidden !== "undefined") {
            visibilityChange = "mozvisibilitychange";
          } else if (typeof document.msHidden !== "undefined") {
            visibilityChange = "msvisibilitychange";
          } else if (typeof document.webkitHidden !== "undefined") {
            visibilityChange = "webkitvisibilitychange";
          }
          return visibilityChange;
        };

        var _addEventListenerVisibilityAPI = function () {
          document.addEventListener(_getVisibilityChangeName(),
            _visibilityListener);
        };

        var _removeEventListenerVisibilityAPI = function () {
          document.removeEventListener(_getVisibilityChangeName(),
            _visibilityListener);
        };

        /*
         * Responsible for triggering the Google OAuth process.
         *
         */
        var _authorize = function (authenticatedUser) {
          var attemptImmediate = false;

          if (_authorizeDeferred) {
            return _authorizeDeferred.promise;
          }

          if (authenticatedUser) {
            if (!_state.user.username || !_state.profile.username ||
              _state.user.username !== authenticatedUser.email) {
              _authorizeDeferred = $q.defer();

              //populate user
              objectHelper.clearAndCopy({
                userId: authenticatedUser.id, //TODO: ideally we should not use real user ID or email, but use hash value instead
                username: authenticatedUser.email,
                picture: authenticatedUser.picture
              }, _state.user);

              _setUserToken(authenticatedUser);

              userState.refreshProfile()
                .then(null, function (err) {
                  if (err && err.code !== 403) {
                    _authorizeDeferred.reject("Refresh Profile Error");

                    _authorizeDeferred = undefined;

                    return $q.reject();
                  }
                })
                .then(function () {
                  _authorizeDeferred.resolve();

                  $rootScope.$broadcast("risevision.user.authorized");

                  if (!attemptImmediate) {
                    $rootScope.$broadcast(
                      "risevision.user.userSignedIn");
                  }

                  _authorizeDeferred = undefined;
                });

              return _authorizeDeferred.promise;
            } else {
              return $q.resolve();
            }
          } else {
            return $q.reject("No user");
          }
        };

        var authenticate = function (forceAuth, credentials) {
          var authenticateDeferred;
          var isRiseAuthUser = false;

          // Clear User state
          if (forceAuth) {
            _authenticateDeferred = null;

            _resetUserState();
          }

          // Return cached promise
          if (_authenticateDeferred) {
            return _authenticateDeferred.promise;
          } else {
            _authenticateDeferred = $q.defer();
          }

          // Always resolve local copy of promise
          // in case cached version is cleared
          authenticateDeferred = _authenticateDeferred;
          $log.debug("authentication called");

          var _proceed = function () {
            var authenticationPromise;

            // Credentials or Token provided; assume authenticated
            if (credentials || _state.userToken && _state.userToken.token &&
              !FORCE_GOOGLE_AUTH) {
              isRiseAuthUser = true;
              authenticationPromise = customAuthFactory.authenticate(
                credentials);
            } else {
              authenticationPromise = googleAuthFactory.authenticate(
                forceAuth);
            }

            authenticationPromise
              .then(_authorize)
              .then(function () {
                userState._setIsRiseAuthUser(isRiseAuthUser);
                authenticateDeferred.resolve();
              })
              .then(null, function (err) {
                if (_state.redirectDetected) {
                  $log.error("Authentication Error from Redirect: ", err);

                  delete _state.redirectDetected;
                } else {
                  $log.debug("Authentication Error: ", err);
                }
                _resetUserState();

                authenticateDeferred.reject(err);
              })
              .finally(function () {
                _addEventListenerVisibilityAPI();

                $loading.stopGlobal("risevision.user.authenticate");

                _logPageLoad("authenticated user");
              });
          };
          // pre-load gapi to prevent popup blocker issues
          auth2APILoader().finally(_proceed);

          if (forceAuth) {
            $loading.startGlobal("risevision.user.authenticate");
          }

          return authenticateDeferred.promise;
        };

        var signOut = function (signOutGoogle) {
          return auth2APILoader().then(function (auth2) {
            if (!userState.isRiseAuthUser()) {
              if (signOutGoogle) {
                $window.logoutFrame.location =
                  "https://accounts.google.com/Logout";
              }

              auth2.getAuthInstance().signOut();
            }

            _authenticateDeferred = null;

            // The flag the indicates a user is potentially
            // authenticated already, must be destroyed.
            _resetUserState();

            //call google api to sign out
            $rootScope.$broadcast("risevision.user.signedOut");
            $log.debug("User is signed out.");
          });
        };

        var userAuthFactory = {
          authenticate: authenticate,
          authenticatePopup: function () {
            return authenticate(true);
          },
          signOut: signOut,
          addEventListenerVisibilityAPI: _addEventListenerVisibilityAPI,
          removeEventListenerVisibilityAPI: _removeEventListenerVisibilityAPI,
        };

        return userAuthFactory;
      }
    ]);

})(angular);

(function () {
  "use strict";

  angular.module("risevision.common.components.userstate")
    .service("userauth", ["$q", "$log", "riseAPILoader",
      function ($q, $log, riseAPILoader) {

        var service = {
          add: function (username, password) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username,
                password: password
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.add(obj);
            })
              .then(function (resp) {
                $log.debug("added user credentials", resp);
                deferred.resolve(resp.result);
              })
              .then(null, function (e) {
                console.error("Failed to add credentials.", e);
                deferred.reject(e);
              });
            return deferred.promise;
          },
          updatePassword: function (username, oldPassword, newPassword) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username,
                oldPassword: oldPassword,
                newPassword: newPassword
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.updatePassword(obj);
            })
              .then(function (resp) {
                $log.debug("update user credentials resp", resp);
                deferred.resolve(resp.result);
              })
              .then(null, function (e) {
                console.error("Failed to update credentials.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          login: function (username, password) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username,
                password: password
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.login(obj);
            })
              .then(function (resp) {
                $log.debug("login successful", resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to login user.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          refreshToken: function (username, token) {
            var deferred = $q.defer();

            var obj = {
              data: {
                token: token
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.refreshToken(obj);
            })
              .then(function (resp) {
                $log.debug("token refresh successful", resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to refresh token.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          confirmUserCreation: function (username, userConfirmedToken) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username,
                userConfirmedToken: userConfirmedToken
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.confirmUserCreation(obj);
            })
              .then(function (resp) {
                $log.debug("Confirm user creation successful", resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to confirm user creation.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          requestConfirmationEmail: function (username) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.requestConfirmationEmail(obj);
            })
              .then(function (resp) {
                $log.debug("Request confirmation email successful",
                  resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to request confirmation email.",
                  e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          requestPasswordReset: function (username) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.requestPasswordReset(obj);
            })
              .then(function (resp) {
                $log.debug("Request password reset successful", resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to request password reset.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          },
          resetPassword: function (username, passwordResetToken,
            newPassword) {
            var deferred = $q.defer();

            var obj = {
              data: {
                username: username,
                passwordResetToken: passwordResetToken,
                newPassword: newPassword
              }
            };
            riseAPILoader().then(function (coreApi) {
              return coreApi.userauth.resetPassword(obj);
            })
              .then(function (resp) {
                $log.debug("Reset password successful", resp);
                deferred.resolve(resp);
              })
              .then(null, function (e) {
                console.error("Failed to reset password.", e);
                deferred.reject(e);
              });

            return deferred.promise;
          }
        };

        return service;
      }
    ]);
})();

(function (angular) {
  "use strict";

  angular.module("risevision.common.components.userstate")
  // constants (you can override them in your app as needed)
  .value("PROFILE_PICTURE_URL",
    "https://www.gravatar.com/avatar/{emailMD5}?d=mm")
    .factory("userState", [
      "$q", "$rootScope", "$window", "$log", "$location", "userInfoCache",
      "getUserProfile", "companyState", "objectHelper",
      "localStorageService", "rvTokenStore", "md5", "PROFILE_PICTURE_URL",
      function ($q, $rootScope, $window, $log, $location, userInfoCache,
        getUserProfile, companyState, objectHelper,
        localStorageService, rvTokenStore, md5, PROFILE_PICTURE_URL) {
        //singleton factory that represents userState throughout application

        var _state = {
          profile: {}, //Rise vision profile
          user: {}, //Google user
          roleMap: {},
          userToken: rvTokenStore.read(),
          inRVAFrame: angular.isDefined($location.search().inRVA),
          isRiseAuthUser: false
        };

        var refreshProfile = function () {
          var deferred = $q.defer();

          //populate profile if the current user is a rise vision user
          getUserProfile(_state.user.username, true)
            .then(function (profile) {
              userState.updateUserProfile(profile);

              //populate company info
              return companyState.init();
            })
            .then(function () {
              deferred.resolve();
            }, deferred.reject);

          return deferred.promise;
        };

        var isLoggedIn = function () {
          if (!_state.user.username) {
            return false;
          } else {
            return true;
          }
        };

        var isRiseVisionUser = function () {
          return _state.profile.username !== null &&
            _state.profile.username !== undefined;
        };

        var hasRole = function (role) {
          return angular.isDefined(_state.roleMap[role]);
        };

        var getAccessToken = function () {
          return $window.gapi && $window.gapi.auth ?
            $window.gapi.auth.getToken() : null;
        };

        var _restoreState = function () {
          var sFromStorage = localStorageService.get(
            "risevision.common.userState");
          if (sFromStorage) {
            angular.extend(_state, sFromStorage);
            localStorageService.remove("risevision.common.userState"); //clear
            $log.debug("userState restored with", sFromStorage);

            _state.redirectDetected = true;
          }
        };

        var _resetState = function () {
          userInfoCache.removeAll();

          objectHelper.clearObj(_state.user);
          objectHelper.clearObj(_state.profile);
          _state.roleMap = {};

          companyState.resetCompanyState();
          $log.debug("User state has been reset.");
        };

        var _getEmailMD5 = function () {
          var emailHash = userState.getUsername() && md5.createHash(
            userState.getUsername());
          var gravatarId = emailHash || "0";
          return PROFILE_PICTURE_URL.replace("{emailMD5}", gravatarId);
        };

        var userState = {
          // user getters
          getUsername: function () {
            return (_state.user && _state.user.username) || null;
          },
          getUserFullName: function () {
            var firstName = (_state.profile && _state.profile.firstName) || "";
            var lastName = (_state.profile && _state.profile.lastName) || "";

            return (firstName + " " + lastName).trim();
          },
          getUserEmail: function () {
            return _state.profile.email;
          },
          getCopyOfProfile: function (noFollow) {
            if (noFollow) {
              return angular.extend({}, _state.profile);
            } else {
              return objectHelper.follow(_state.profile);
            }
          },
          getUserPicture: function () {
            return _state.user.picture || _getEmailMD5();
          },
          hasRole: hasRole,
          inRVAFrame: function () {
            return _state.inRVAFrame;
          },
          isRiseAdmin: function () {
            return hasRole("sa") && companyState.isRootCompany();
          },
          isRiseStoreAdmin: function () {
            return hasRole("ba") && companyState.isRootCompany();
          },
          isUserAdmin: function () {
            return hasRole("ua");
          },
          isPurchaser: function () {
            return hasRole("pu");
          },
          isRiseAuthUser: function () {
            return _state.isRiseAuthUser;
          },
          isSeller: companyState.isSeller,
          isRiseVisionUser: isRiseVisionUser,
          isLoggedIn: isLoggedIn,
          getAccessToken: getAccessToken,
          // user functions
          checkUsername: function (username) {
            return (username || false) &&
              (userState.getUsername() || false) &&
              username.toUpperCase() === userState.getUsername().toUpperCase();
          },
          updateUserProfile: function (user) {
            if (userState.checkUsername(user.username)) {
              objectHelper.clearAndCopy(angular.extend({
                username: _state.user.username
              }, user), _state.profile);

              //set role map
              _state.roleMap = {};
              if (_state.profile.roles) {
                _state.profile.roles.forEach(function (val) {
                  _state.roleMap[val] = true;
                });
              }

              $rootScope.$broadcast("risevision.user.updated");
            }
          },
          refreshProfile: refreshProfile,
          // company getters
          getUserCompanyId: companyState.getUserCompanyId,
          getUserCompanyName: companyState.getUserCompanyName,
          getSelectedCompanyId: companyState.getSelectedCompanyId,
          getSelectedCompanyName: companyState.getSelectedCompanyName,
          getSelectedCompanyCountry: companyState.getSelectedCompanyCountry,
          getCopyOfUserCompany: companyState.getCopyOfUserCompany,
          getCopyOfSelectedCompany: companyState.getCopyOfSelectedCompany,
          isSubcompanySelected: companyState.isSubcompanySelected,
          isTestCompanySelected: companyState.isTestCompanySelected,
          isRootCompany: companyState.isRootCompany,
          isSelectedCompanyChargebee: companyState.isSelectedCompanyChargebee,
          isEducationCustomer: companyState.isEducationCustomer,
          // company functions
          updateCompanySettings: companyState.updateCompanySettings,
          updateUserCompanySettings: companyState.updateUserCompanySettings,
          resetCompany: companyState.resetCompany,
          switchCompany: companyState.switchCompany,
          reloadSelectedCompany: companyState.reloadSelectedCompany,
          // private
          _restoreState: _restoreState,
          _resetState: _resetState,
          _setUserToken: function (params) {
            // save params in state in case of redirect
            _state.params = params;

            // set fake user token to idicate user is logged in
            _state.userToken = "dummy";
          },
          _persistState: function () {
            // persist user state
            localStorageService.set("risevision.common.userState",
              _state);
          },
          _state: _state,
          _setIsRiseAuthUser: function (isRiseAuthUser) {
            _state.isRiseAuthUser = isRiseAuthUser;
          }
        };

        return userState;
      }
    ]);

})(angular);

"use strict";

angular.module("risevision.common.components.userstate")
  .directive("confirmPasswordValidator", [

    function () {
      return {
        require: "ngModel",
        restrict: "A",
        scope: {
          confirmPasswordValidator: "="
        },
        link: function (scope, elem, attr, ngModel) {
          var validator = function (value) {
            if (!value || !scope.confirmPasswordValidator ||
              value === scope.confirmPasswordValidator) {
              ngModel.$setValidity("passwordMatch", true);
            } else {
              ngModel.$setValidity("passwordMatch", false);
            }

            return value;
          };

          ngModel.$parsers.unshift(validator);
          ngModel.$formatters.unshift(validator);
        }
      };
    }
  ]);

"use strict";

angular.module("risevision.common.components.userstate")
  .controller("ConfirmAccountCtrl", ["$scope", "$loading", "$log", "$state",
    "$stateParams", "userauth",
    function ($scope, $loading, $log, $state, $stateParams, userauth) {
      $loading.startGlobal("auth-confirm-account");

      userauth.confirmUserCreation($stateParams.user, $stateParams.token)
        .then(function () {
          $log.log("User confirmed");
        })
        .catch(function (err) {
          console.error(err);
        })
        .finally(function () {
          $loading.stopGlobal("auth-confirm-account");
          $state.go("common.auth.unauthorized", {
            accountConfirmed: true
          });
        });
    }
  ]);

"use strict";

angular.module("risevision.common.components.userstate")
  .controller("LoginCtrl", ["$scope", "$loading", "$stateParams",
    "$state", "userAuthFactory", "customAuthFactory", "uiFlowManager",
    "urlStateService", "userState", "FORCE_GOOGLE_AUTH",
    function ($scope, $loading, $stateParams, $state, userAuthFactory,
      customAuthFactory, uiFlowManager, urlStateService, userState,
      FORCE_GOOGLE_AUTH) {
      $scope.forms = {};
      $scope.credentials = {};
      $scope.messages = {};
      $scope.errors = {};
      $scope.FORCE_GOOGLE_AUTH = FORCE_GOOGLE_AUTH;

      $scope.isSignUp = $stateParams.isSignUp;
      $scope.joinAccount = $stateParams.joinAccount;
      $scope.companyName = $stateParams.companyName;
      $scope.messages.passwordReset = $stateParams.passwordReset;
      $scope.messages.accountConfirmed = $stateParams.accountConfirmed;

      $scope.googleLogin = function (endStatus) {
        $loading.startGlobal("auth-buttons-login");
        userAuthFactory.authenticate(true)
          .finally(function () {
            $loading.stopGlobal("auth-buttons-login");
            uiFlowManager.invalidateStatus(endStatus);
          });
      };

      $scope.customLogin = function (endStatus) {
        $scope.errors = {};
        $scope.messages = {};

        if ($scope.forms.loginForm.$valid) {
          $loading.startGlobal("auth-buttons-login");
          userAuthFactory.authenticate(true, $scope.credentials)
            .then(function () {
              urlStateService.redirectToState($stateParams.state);
            })
            .catch(function (err) {
              if (err.status === 400) {
                $scope.messages.isGoogleAccount = true;
              } else if (err.status === 409) {
                $scope.errors.unconfirmedError = true;
              } else { // No special case for 404, for security reasons
                console.error(err);
                $scope.errors.loginError = true;
              }
            })
            .finally(function () {
              $loading.stopGlobal("auth-buttons-login");
              uiFlowManager.invalidateStatus(endStatus);
            });
        }
      };

      $scope.createAccount = function (endStatus) {
        $scope.errors = {};
        $scope.messages = {};

        if ($scope.forms.loginForm.$valid) {
          $loading.startGlobal("auth-buttons-login");

          customAuthFactory.addUser($scope.credentials)
            .then(function () {
              $scope.errors.confirmationRequired = true;
            })
            .then(null, function () {
              $scope.errors.duplicateError = true;
            })
            .finally(function () {
              $loading.stopGlobal("auth-buttons-login");
              uiFlowManager.invalidateStatus(endStatus);
            });
        }
      };
    }
  ]);

"use strict";

angular.module("risevision.common.components.userstate")
  .controller("RequestConfirmationEmailCtrl", ["$scope", "$loading", "$log",
    "userauth",
    function ($scope, $loading, $log, userauth) {
      $scope.forms = {};
      $scope.credentials = {};
      $scope.emailSent = false;
      $scope.isGoogleAccount = false;
      $scope.emailAlreadyConfirmed = false;

      $scope.requestConfirmationEmail = function () {
        $scope.emailSent = false;
        $scope.isGoogleAccount = false;
        $scope.emailAlreadyConfirmed = false;
        $loading.startGlobal("auth-request-confirmation-email");

        userauth.requestConfirmationEmail($scope.credentials.username)
          .then(function () {
            $log.log("Confirmation email request sent");
            $scope.emailSent = true;
          })
          .catch(function (err) {
            if (err.status === 400) {
              $log.log("Requested confirmation email for Google account");
              $scope.isGoogleAccount = true;
            } else if (err.status === 409) {
              $log.log(
                "Requested confirmation email for already confirmed account"
              );
              $scope.emailAlreadyConfirmed = true;
            } else { // No special case for 404, for security reasons
              console.error(err);
              $scope.emailSent = true;
            }
          })
          .finally(function () {
            $loading.stopGlobal("auth-request-confirmation-email");
          });
      };
    }
  ]);

"use strict";

angular.module("risevision.common.components.userstate")
  .controller("RequestPasswordResetCtrl", ["$scope", "$loading", "$log",
    "userauth",
    function ($scope, $loading, $log, userauth) {
      $scope.forms = {};
      $scope.credentials = {};
      $scope.errors = {};
      $scope.emailSent = false;
      $scope.isGoogleAccount = false;

      $scope.requestPasswordReset = function () {
        $scope.emailSent = false;
        $scope.isGoogleAccount = false;
        $loading.startGlobal("auth-request-password-reset");

        userauth.requestPasswordReset($scope.credentials.username)
          .then(function () {
            $log.log("Reset password request sent");
            $scope.emailSent = true;
          })
          .catch(function (err) {
            if (err.status === 400) {
              $log.log("Requested password reset for Google account");
              $scope.isGoogleAccount = true;
            } else { // No special case for 404, for security reasons
              console.error(err);
              $scope.emailSent = true;
            }
          })
          .finally(function () {
            $loading.stopGlobal("auth-request-password-reset");
          });
      };
    }
  ]);

"use strict";

angular.module("risevision.common.components.userstate")
  .controller("ResetPasswordConfirmCtrl", ["$scope", "$loading", "$log",
    "$state", "$stateParams", "userauth",
    function ($scope, $loading, $log, $state, $stateParams, userauth) {
      $scope.forms = {};
      $scope.credentials = {};
      $scope.errors = {};

      function _resetErrorStates() {
        $scope.emailResetSent = false;
        $scope.invalidToken = false;
      }

      $scope.resetPassword = function () {
        _resetErrorStates();

        if ($scope.forms.resetPasswordForm.$valid) {
          $loading.startGlobal("auth-reset-password");
          userauth.resetPassword($stateParams.user, $stateParams.token, $scope.credentials
            .newPassword)
            .then(function () {
              $log.log("Password updated");
              $state.go("common.auth.unauthorized", {
                passwordReset: true
              });
            })
            .catch(function (err) {
              var error = err.result && err.result.error && err.result.error.message;

              if (error === "Password reset token does not match") {
                $scope.invalidToken = true;
              } else {
                console.error(err);
              }
            })
            .finally(function () {
              $loading.stopGlobal("auth-reset-password");
            });
        }
      };

      $scope.requestPasswordReset = function () {
        _resetErrorStates();

        $loading.startGlobal("auth-request-password-reset");
        userauth.requestPasswordReset($stateParams.user)
          .then(function () {
            $log.log("Email sent");
            $scope.emailResetSent = true;
          })
          .catch(function (err) {
            console.error(err);
          })
          .finally(function () {
            $loading.stopGlobal("auth-request-password-reset");
          });
      };
    }
  ]);

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/auth-common.html',
    '<div class="app-launcher-login"><div class="container"><div class="panel"><div class="row"><div class="col-sm-6 col-xs-12"><div class="rise-logo"><img src="https://s3.amazonaws.com/Rise-Images/Website/rise-logo.svg"></div></div><div class="col-sm-6 col-xs-12"><div ui-view=""></div></div></div></div></div></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/auth-form.html',
    '<form id="forms.loginForm" name="forms.loginForm" role="form" novalidate=""><div><div class="panel-body bg-danger u_margin-sm-top" ng-show="errors.duplicateError"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span id="already-registered-warning">This email address is already registered. You can <a ui-sref="common.auth.unauthorized">sign in</a> with this address.</span></p></div><div class="panel-body bg-danger u_margin-sm-top" ng-show="errors.loginError"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span id="incorrect-credentials-error">Your email address/password combination is incorrect.<br>If you are having problems signing in, please check this <a href="https://help.risevision.com/hc/en-us/articles/115001402743-I-am-having-trouble-logging-in-what-can-I-do-" target="_blank">Help Center article</a>.</span></p></div><div class="panel-body bg-info u_margin-sm-top" ng-show="errors.unconfirmedError"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>Your email address has not been confirmed.<br><a ui-sref="common.auth.requestconfirmationemail">Resend Email Confirmation</a></span></p></div><div class="panel-body bg-info u_margin-sm-top" ng-show="errors.confirmationRequired"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>We\'ve sent a confirmation email to {{credentials.username}}.<br>Please check your inbox to complete your account registration.</span></p></div><div class="panel-body bg-info u_margin-sm-top" ng-show="messages.passwordReset"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>Password successfully updated.<br>Please sign in to proceed.</span></p></div><div class="panel-body bg-info u_margin-sm-top" ng-show="messages.accountConfirmed"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>Account successfully confirmed.<br>Please sign in to proceed.</span></p></div><div class="panel-body bg-danger u_margin-sm-top" ng-show="messages.isGoogleAccount"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>This account is authenticated by Google.<br>Please, use the \'Sign in with Google\' button.</span></p></div></div><div class="u_margin-sm-top" ng-show="!errors.confirmationRequired"><div class="form-group" ng-class="{\'has-error\': (forms.loginForm.$submitted && forms.loginForm.username.$invalid)}" show-errors=""><label class="control-label">Email</label> <input type="email" class="form-control" placeholder="Enter Your Email Address" id="username" name="username" ng-model="credentials.username" required="" focus-me="true" autocomplete="email"><p class="text-danger" ng-show="forms.loginForm.$submitted && forms.loginForm.username.$invalid">Please enter an Email</p></div><div class="form-group" ng-class="{\'has-error\': (forms.loginForm.$submitted && forms.loginForm.password.$invalid && isSignUp), \'has-message\': forms.loginForm.password.$valid && isSignUp}" show-errors=""><label class="control-label">{{ isSignUp ? \'Create \' : \'\'}}Password</label> <input type="password" class="form-control" placeholder="Enter Password" id="password" name="password" ng-model="credentials.password" required="" minlength="4"><p class="text-danger" ng-show="forms.loginForm.$submitted && forms.loginForm.password.$error.minlength && isSignUp">New Password must be at least 4 characters long.</p><p class="text-warning" ng-show="forms.loginForm.password.$valid && isSignUp">A strong password is at least 8 characters, includes uppercase/lowercase letters, and one or more numbers.</p></div><div class="form-group" ng-class="{ \'has-error\' : (forms.loginForm.$submitted && forms.loginForm.confirmPassword.$invalid) }" ng-if="isSignUp"><label class="control-label" for="confirm-password">Confirm Password</label> <input id="confirmPassword" type="password" name="confirmPassword" class="form-control" placeholder="Re-type Password" ng-model="credentials.confirmPassword" required="" confirm-password-validator="credentials.password"><p ng-show="forms.loginForm.$submitted && forms.loginForm.confirmPassword.$error.required" class="text-danger">Confirm Password is required.</p><p ng-show="forms.loginForm.$submitted && forms.loginForm.confirmPassword.$error.passwordMatch" class="text-danger">New Password and Confirm Password must match.</p></div></div></form>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/create-account.html',
    '<div ng-if="!joinAccount"><h1 class="u_remove-top">Get Started For Free</h1><p class="lead text-muted">No credit card or commitment required.</p></div><div ng-if="joinAccount"><h1 class="u_remove-top">Join Your Company</h1><p class="lead text-muted">Complete your account <span ng-if="!companyName">registration</span><span ng-if="companyName">with {{companyName}}</span>.</p></div><div class="col-xs-12 col-md-8" ng-show="!errors.confirmationRequired"><button class="btn btn-google-auth btn-hg" id="sign-up-google-link" ng-click="googleLogin(\'registrationComplete\')"><span><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"> Sign up with Google</span></button></div><div class="section-divider col-xs-12 col-md-8 u_margin-md-top" ng-show="!errors.confirmationRequired" ng-if="!FORCE_GOOGLE_AUTH"><div></div><span>OR</span><div></div></div><div class="col-md-8 col-xs-12" ng-if="!FORCE_GOOGLE_AUTH"><div ng-include="\'userstate/auth-form.html\'"></div><div class="form-group" ng-show="!errors.confirmationRequired"><button id="sign-up-button" class="btn btn-primary btn-hg" type="submit" form="forms.loginForm" ng-click="createAccount(\'registrationComplete\')"><span translate="Sign Up"></span></button></div></div><br><div class="col-xs-12 u_margin-lg-top"><p class="text-muted">Already have an account? <a id="sign-in-link" ui-sref="common.auth.unauthorized">Sign in</a></p></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/login.html',
    '<h1 class="u_remove-top">Sign In</h1><p class="lead text-muted">to your Rise Vision account</p><div class="col-xs-12 col-md-8"><button class="btn btn-google-auth btn-hg" id="sign-in-google-link" ng-click="googleLogin(\'registrationComplete\')"><span><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"> Sign in with Google</span></button></div><div class="section-divider col-xs-12 col-md-8 u_margin-md-top" ng-if="!FORCE_GOOGLE_AUTH"><div></div><span>OR</span><div></div></div><div class="col-md-8 col-xs-12" ng-if="!FORCE_GOOGLE_AUTH"><div ng-include="\'userstate/auth-form.html\'"></div><div class="form-group"><button id="sign-in-button" class="btn btn-primary btn-hg" type="submit" form="forms.loginForm" ng-click="customLogin(\'registrationComplete\')"><span translate="Sign In"></span></button></div></div><br><div class="col-xs-12 u_margin-lg-top"><p class="text-muted" ng-if="!FORCE_GOOGLE_AUTH"><a id="reset-password-link" ui-sref="common.auth.requestpasswordreset">Forgot your password?</a></p><p class="text-muted">Don\'t have an account? <a id="sign-up-link" ui-sref="common.auth.createaccount">Sign up</a></p></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/request-confirmation-email.html',
    '<h1 class="u_remove-top">Send Confirmation Email</h1><div class="col-xs-12 col-md-8"><div class="panel-body bg-info u_margin-lg-top" ng-show="emailSent"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>We\'ve sent a confirmation email to {{credentials.username}}.<br>Please check your inbox to complete your account registration.<br></span></p></div><div class="panel-body bg-info u_margin-lg-top" ng-show="emailAlreadyConfirmed"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>The {{credentials.username}} account is already confirmed.</span></p></div><div class="panel-body bg-danger u_margin-lg-top" ng-show="isGoogleAccount"><p class="u_remove-bottom"><span><i class="fa fa-warning icon-left"></i> This account is authenticated by Google.<br><p class="text-muted">You can <a id="sign-in-link" ui-sref="common.auth.unauthorized">Sign in with Google</a> in our login page.</p></span></p></div></div><form id="confirmationEmailForm" role="form" name="forms.confirmationEmailForm" novalidate="" ng-show="!emailSent"><div class="col-md-8 col-xs-12 u_margin-md-top"><div class="form-group" ng-class="{\'has-error\': (forms.confirmationEmailForm.$submitted && forms.confirmationEmailForm.username.$invalid)}" show-errors=""><label class="control-label">Email</label> <input type="text" class="form-control" name="username" ng-model="credentials.username" required="" focus-me="true"><p class="text-danger" ng-show="forms.confirmationEmailForm.$submitted && forms.confirmationEmailForm.username.$invalid">Please enter an Email</p></div><button class="btn btn-primary btn-hg" ng-disabled="forms.confirmationEmailForm.$invalid" ng-click="requestConfirmationEmail()">Send Confirmation Email</button></div></form><br><div class="col-xs-12 u_margin-lg-top"><p class="text-muted"><a id="sign-in-link" ui-sref="common.auth.unauthorized">Sign in</a> to your account instead.</p></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/request-password-reset.html',
    '<h1 class="u_remove-top">Password Reset</h1><div class="col-xs-12 col-md-8"><div class="panel-body bg-info u_margin-lg-top" ng-show="emailSent"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>An email with password reset instructions has been sent to your email inbox (if it exists in our system).</span></p></div><div class="panel-body bg-danger u_margin-lg-top" ng-show="isGoogleAccount"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>This account is authenticated by Google.<br><a href="https://myaccount.google.com/security#signin" target="_blank">Change your password on your Google account.</a></span></p></div></div><form id="requestResetForm" role="form" name="forms.requestResetForm" novalidate="" ng-show="!emailSent"><div class="col-md-8 col-xs-12 u_margin-md-top"><div class="form-group" ng-class="{\'has-error\': (forms.requestResetForm.$submitted && forms.requestResetForm.username.$invalid)}" show-errors=""><label class="control-label">Email</label> <input type="text" class="form-control" name="username" ng-model="credentials.username" required="" focus-me="true"><p class="text-danger" ng-show="forms.requestResetForm.$submitted && forms.requestResetForm.username.$invalid">Please enter an Email</p></div><button class="btn btn-primary btn-hg" ng-disabled="forms.requestResetForm.$invalid" ng-click="requestPasswordReset()">Reset Password</button></div></form><br><div class="col-xs-12 u_margin-lg-top"><p class="text-muted"><a id="sign-in-link" ui-sref="common.auth.unauthorized">Sign in</a> to your account instead.</p></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/reset-password-confirm.html',
    '<h1 class="u_remove-top">Password Confirmation</h1><div><div class="panel-body bg-info u_margin-lg-top" ng-show="emailResetSent"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>An email with password reset instructions has been sent to your email inbox.</span></p></div><div class="panel-body bg-danger u_margin-lg-top" ng-show="invalidToken"><p class="u_remove-bottom"><i class="fa fa-warning icon-left"></i> <span>The password reset token is not valid. <a href="#" ng-click="requestPasswordReset()">Request Password Reset</a></span></p></div></div><form id="forms.resetPasswordForm" role="form" name="forms.resetPasswordForm" novalidate="" ng-show="!emailResetSent"><div class="col-md-8 col-xs-12 u_margin-md-top"><div class="form-group" ng-class="{\'has-error\': (forms.resetPasswordForm.$submitted && forms.resetPasswordForm.newPassword.$invalid)}" show-errors=""><label class="control-label">New Password</label> <input type="password" class="form-control" name="newPassword" id="newPassword" ng-model="credentials.newPassword" required="" minlength="4" focus-me="true"><p class="text-danger" ng-show="forms.resetPasswordForm.$submitted && forms.resetPasswordForm.newPassword.$error.minlength">New Password must be at least 4 characters long.</p><p class="text-warning" ng-show="forms.resetPasswordForm.newPassword.$valid">A strong password is at least 8 characters, includes uppercase/lowercase letters, and one or more numbers.</p></div><div class="form-group" ng-class="{\'has-error\': (forms.resetPasswordForm.$submitted && forms.resetPasswordForm.confirmPassword.$invalid)}" show-errors=""><label class="control-label">Confirm Password</label> <input type="password" class="form-control" name="confirmPassword" id="confirmPassword" ng-model="credentials.confirmPassword" required="" confirm-password-validator="credentials.newPassword"><p ng-show="forms.resetPasswordForm.$submitted && forms.resetPasswordForm.confirmPassword.$error.required" class="text-danger">Confirm Password is required.</p><p ng-show="forms.resetPasswordForm.$submitted && forms.resetPasswordForm.confirmPassword.$error.passwordMatch" class="text-danger">New Password and Confirm Password must match.</p></div><button id="resetPasswordButton" type="submit" form="forms.resetPasswordForm" class="btn btn-primary btn-hg" ng-click="resetPassword()">Update Password</button></div></form>');
}]);
})();

(function(module) {
try {
  module = angular.module('risevision.common.components.userstate');
} catch (e) {
  module = angular.module('risevision.common.components.userstate', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('userstate/unsubscribe.html',
    '<div class="alert alert-warning col-xs-12 u_margin-md-top"><strong>{{email}}</strong> has been unsubscribed from monitoring the Display <strong>\'{{name}}\'</strong>. (Display ID: {{id}})</div><a id="reset-password-link" href="/">Sign in to your Rise Vision account</a><p></p>');
}]);
})();
