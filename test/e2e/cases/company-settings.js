(function() {

  "use strict";

  var expect = require('rv-common-e2e').expect;
  var assert = require('rv-common-e2e').assert;
  var helper = require('rv-common-e2e').helper;
  var CommonHeaderPage = require('./../pages/commonHeaderPage.js');
  var HomePage = require('./../pages/homepage.js');
  var CompanySettingsModalPage = require('./../pages/companySettingsModalPage.js');

  var CompanySettingsScenarios = function() {

    describe("Companies Settings", function() {
      var commonHeaderPage, 
        homepage, 
        companySettingsModalPage;
        
      before(function (){
        commonHeaderPage = new CommonHeaderPage();
        homepage = new HomePage();
        companySettingsModalPage = new CompanySettingsModalPage();

        homepage.get();

        //sign in, wait for spinner to go away
        helper.waitDisappear(commonHeaderPage.getLoader(), 'CH spinner loader').then(function () {
          commonHeaderPage.signin();
        });
      });

      describe("Company Settings", function () {
        it("Opens Company Settings Dialog", function() {
          commonHeaderPage.getProfilePic().click();

          expect(homepage.getCompanySettingsButton().isDisplayed()).to.eventually.be.true;
          homepage.getCompanySettingsButton().click();
          
          helper.wait(companySettingsModalPage.getCompanySettingsModal(), "Comapny Settings Modal");
          
          expect(companySettingsModalPage.getCompanySettingsModal().isDisplayed()).to.eventually.be.true;
        });
        
        it("Loads company settings", function() {
          helper.waitDisappear(companySettingsModalPage.getLoader(), "Load Company Settings");
          
          expect(companySettingsModalPage.getNameField().getAttribute('value')).to.eventually.be.ok;
          expect(companySettingsModalPage.getNameField().getAttribute("value")).to.eventually.equal("Public School #5");
        });

        it("Resets auth key", function() {
          var authKey = companySettingsModalPage.getAuthKeyField().getText();
          
          companySettingsModalPage.getResetAuthKeyButton().click();

          helper.waitForAlert("Confirm Auth Key reset");
          browser.switchTo().alert().then(function (prompt){ prompt.accept(); }); //confirm reset
          
          helper.waitForAlert("Auth Key reset");
          browser.switchTo().alert().then(function (prompt){ prompt.accept(); }); //acknowledge reset message
          
          expect(companySettingsModalPage.getAuthKeyField().getText()).to.eventually.be.ok;
          expect(companySettingsModalPage.getAuthKeyField().getText()).to.eventually.not.equal(authKey);
        });

        it("Resets claim id", function() {
          var claimId = companySettingsModalPage.getClaimIdField().getText();
          
          companySettingsModalPage.getResetClaimIdButton().click();

          helper.waitForAlert("Confirm Claim Id reset");
          browser.switchTo().alert().then(function (prompt){ prompt.accept(); }); //confirm reset
          
          helper.waitForAlert("Claim Id reset");
          browser.switchTo().alert().then(function (prompt){ prompt.accept(); }); //acknowledge reset message
          
          expect(companySettingsModalPage.getClaimIdField().getText()).to.eventually.be.ok;
          expect(companySettingsModalPage.getClaimIdField().getText()).to.eventually.not.equal(claimId);
        });

        it("Flags invalid Company address", function() {          
          expect(companySettingsModalPage.getFormError().isDisplayed()).to.eventually.be.false;

          companySettingsModalPage.getStreetField().sendKeys("515 King St W");

          companySettingsModalPage.getSaveButton().click();
          helper.waitDisappear(companySettingsModalPage.getLoader(), "Load Company Settings");

          expect(companySettingsModalPage.getFormError().isDisplayed()).to.eventually.be.true;
          expect(companySettingsModalPage.getFormError().getText()).to.eventually.be.ok;
          expect(companySettingsModalPage.getFormError().getText()).to.eventually.equal("We couldn't update your address. \"The address value was incomplete.\"");
        });

        it("Saves company with empty address and closes dialog", function () {
          companySettingsModalPage.getStreetField().clear();

          companySettingsModalPage.getSaveButton().click();
          helper.waitDisappear(companySettingsModalPage.getCompanySettingsModal(), "Company Settings Modal");
          
          expect(companySettingsModalPage.getCompanySettingsModal().isPresent()).to.eventually.be.false;
        });
      });

    });
  };
  
  module.exports = CompanySettingsScenarios;
  
})();
