angular.module("risevision.common.components.purchase-flow")
  .directive("checkoutSuccess", ["$templateCache", "purchaseFactory",
    function ($templateCache, purchaseFactory) {
      return {
        restrict: "E",
        template: $templateCache.get("purchase-flow/checkout-success.html"),
        link: function ($scope) {
          $scope.purchase = purchaseFactory.purchase;
        }
      };
    }
  ]);
