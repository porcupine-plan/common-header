(function() {

  "use strict";

  var expect = require('rv-common-e2e').expect;
  var assert = require('rv-common-e2e').assert;
  var CommonHeaderPage = require('rv-common-e2e').commonHeaderPage;
  var HelpDropdownPage = require('./../pages/helpDropdownPage.js');
  var helper = require('rv-common-e2e').helper;

  var HelpScenarios = function() {

    browser.driver.manage().window().setSize(1280, 768);

    describe("Help", function () {
      this.timeout(2000);// to allow for protactor to load the seperate page
      var commonHeaderPage, helpDropdownPage;
      before(function () {
        commonHeaderPage = new CommonHeaderPage();
        helpDropdownPage = new HelpDropdownPage();

        browser.get("http://localhost:8099/test/e2e");
        helper.waitDisappear(commonHeaderPage.getLoader(), 'CH spinner loader');
      });

      it("should show the help dropdown button", function () {
        assert.eventually.isTrue(helpDropdownPage.getHelpDropdownButton().isDisplayed(), "Help dropdown button should show");
      });

      describe("Given a user clicks on the help dropdown button", function () {

        before(function () {
          helpDropdownPage.getHelpDropdownButton().click();
        });

        it("should show the ask the community button", function () {
          assert.eventually.isTrue(helpDropdownPage.getAskCommunityButton().isDisplayed(), "Ask the Community button should show");
        });

        it("should show the priority support button", function () {
          assert.eventually.isTrue(helpDropdownPage.getPrioritySupportButton().isDisplayed(), "Priority Support button should show");
        });

        it("should show the send us a note button", function () {
          assert.eventually.isTrue(helpDropdownPage.getSendUsANoteButton().isDisplayed(), "Send Us a Note button should show");
        });

        it("should show the sign up for training button", function () {
          assert.eventually.isTrue(helpDropdownPage.getSignUpForTrainingButton().isDisplayed(), "Sign Up for Training button should show");
        });

        it("should show the documentation button", function () {
          assert.eventually.isTrue(helpDropdownPage.getDocumentationButton().isDisplayed(), "Documentation button should show");
        });

        describe("Given a user clicks on the Ask The Community button", function () {
          var newWindowHandle, oldWindowHandle;
          before(function () {
            helpDropdownPage.getAskCommunityButton().click();
          });

          it("should open the Community homepage in a new tab", function () {
            browser.getAllWindowHandles().then(function (handles) {
              oldWindowHandle = handles[0];
              newWindowHandle = handles[1];
              browser.switchTo().window(newWindowHandle).then(function () {
                expect(browser.driver.getCurrentUrl()).to.eventually.equal("https://community.risevision.com/rise_vision_inc");
              });
            });
          });

          after(function () {
            browser.driver.close();
            browser.switchTo().window(oldWindowHandle);
            helpDropdownPage.getHelpDropdownButton().click();
          });
        });

        xdescribe("Given a user clicks on the Priority Support button", function () {
          before(function () {
            helpDropdownPage.getPrioritySupportButton().click();
          });

          it("should open the priority support modal", function () {
            assert.eventually.isTrue(helpDropdownPage.getPrioritySupportModal().isDisplayed(), "Priority Support Modal should show");
          });

          xit("should open the intercom messenger", function () {
            assert.eventually.isTrue(helpDropdownPage.getIntercomMessenger().isDisplayed(), "Intercom Messenger should show");
          });

          after(function () {
            //helpDropdownPage.getPrioritySupportModalCloseButton().click();
            //helpDropdownPage.getHelpDropdownButton().click();
          });
        });

        describe("Given a user clicks on the Send us a note button", function () {
          before(function () {
            helpDropdownPage.getSendUsANoteButton().click();
          });

          xit("should open the intercom messenger", function () {
            assert.eventually.isTrue(helpDropdownPage.getIntercomMessenger().isDisplayed(), "Intercom Messenger should show");
          });

          after(function () {
            //helpDropdownPage.getPrioritySupportModalCloseButton().click();
            helpDropdownPage.getHelpDropdownButton().click();
          });
        });

        describe("Given a user clicks on the Sign Up for Training button", function () {
          var newWindowHandle, oldWindowHandle;
          before(function () {
            helpDropdownPage.getSignUpForTrainingButton().click();
          });

          it("should open the training product page on store in a new tab", function () {
            browser.getAllWindowHandles().then(function (handles) {
              oldWindowHandle = handles[0];
              newWindowHandle = handles[1];
              browser.switchTo().window(newWindowHandle).then(function () {
                expect(browser.driver.getCurrentUrl()).to.eventually.contain("https://store.risevision.com/product/30/rise-training");
              });
            });
          });

          after(function () {
            browser.driver.close();
            browser.switchTo().window(oldWindowHandle);
            helpDropdownPage.getHelpDropdownButton().click();
          });
        });

        describe("Given a user clicks on the Documentation button", function () {
          var newWindowHandle, oldWindowHandle;
          before(function () {
            helpDropdownPage.getDocumentationButton().click();
          });

          it("should open the user documentation on a new tab", function () {
            browser.getAllWindowHandles().then(function (handles) {
              oldWindowHandle = handles[0];
              newWindowHandle = handles[1];
              browser.switchTo().window(newWindowHandle).then(function () {
                expect(browser.driver.getCurrentUrl()).to.eventually.contain("https://help.risevision.com/user");
              });
            });
          });

          after(function () {
            browser.driver.close();
            browser.switchTo().window(oldWindowHandle);
            helpDropdownPage.getHelpDropdownButton().click();
          });
        });
      });

    });
  };
  module.exports = HelpScenarios;
})();