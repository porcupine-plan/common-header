"use strict";

/*jshint -W030 */

describe("controller: Company ICP Modal", function() {
  beforeEach(module("risevision.common.header"));
  beforeEach(module(function ($provide, $translateProvider) {
    $provide.service("$modalInstance",function(){
      return {
        dismiss : sinon.stub(),
        close: sinon.stub()
      };
    });
    $provide.value("user", {
      username: "user@example.io"
    });
    $provide.value("company", {
      name: "Test Company"
    });

    $provide.factory("customLoader", function ($q) {
      return function () {
        var deferred = $q.defer();
        deferred.resolve({});
        return deferred.promise;
      };
    });

    $translateProvider.useLoader("customLoader");
  }));
  var $scope, $modalInstance;
  beforeEach(function(){
    inject(function($injector,$rootScope, $controller){
      $scope = $rootScope.$new();
      $modalInstance = $injector.get("$modalInstance");

      $controller("CompanyIcpModalCtrl", {
        $scope : $scope,
        $modalInstance: $modalInstance,
      });
      $scope.$digest();
    });
  });
    
  it("should exist", function() {
    expect($scope).to.be.ok;
    expect($scope.user).to.be.ok;
    expect($scope.company).to.be.ok;
    
    expect($scope).to.have.property("COMPANY_INDUSTRY_FIELDS");
    expect($scope).to.have.property("COMPANY_SIZE_FIELDS");
    expect($scope).to.have.property("COMPANY_ROLE_FIELDS");

    expect($scope.dismiss).to.exist;
    expect($scope.save).to.exist;
    expect($scope.selectIndustry).to.exist;
  });

  it("should initialize", function() {
    expect($scope.user.username).to.equal("user@example.io");
    expect($scope.company.name).to.equal("Test Company");
  });
  
  it("should close modal on save and send user/company objects", function() {
    $scope.save();

    $modalInstance.close.should.have.been.calledWith({user: {username: "user@example.io"}, company: {name: "Test Company"}});
  });
  
  it("should dismiss modal and send user object", function() {
    $scope.dismiss();

    $modalInstance.dismiss.should.have.been.calledWith({username: "user@example.io"});
  });

  it("selectIndustry: ", function() {
    $scope.selectIndustry("Industry1");
    expect($scope.company.companyIndustry).to.equal("Industry1");

    $scope.selectIndustry("Industry2");
    expect($scope.company.companyIndustry).to.equal("Industry2");

    $scope.selectIndustry("Industry2");
    expect($scope.company.companyIndustry).to.equal("");
  });
    
});
  