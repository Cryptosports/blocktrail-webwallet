(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("WalletSummaryCtrl", WalletSummaryCtrl);

    function WalletSummaryCtrl($scope, $rootScope, $q, $timeout, activeWallet,
                               launchService, settingsService, buyBTCService, $modal, CurrencyConverter) {

        var settings = settingsService.getReadOnlySettings();
        var transactionsListLimitStep = 15;
        var lastDateHeader = 0; // used to keep track of the last date header added
        var timeoutPromise = null;
        var timeoutDelay = 2000;

        $rootScope.pageTitle = 'TRANSACTIONS';
        $scope.walletData = activeWallet.getReadOnlyWalletData();
        $scope.isLoading = true;
        $scope.isShowNoMoreTransactions = false;
        $scope.isTwoFactorWarning = false; // display 2FA warning once every day when it's not enabled
        $scope.lastDateHeader = lastDateHeader;
        $scope.buybtcPendingOrders = []; // Glidera transactions
        $scope.transactionsListLimit = transactionsListLimitStep;

        // Methods
        $scope.isHeader = isHeader;
        $scope.getTransactionHeader = getTransactionHeader;
        $scope.onShowTransaction = onShowTransaction;
        $scope.onShowMoreTransactions = onShowMoreTransactions;

        $scope.$on("$destroy", onDestroy);

        initData();

        function initData() {
            $q.all([
                $q.when($rootScope.getPrice()),
                $q.when(twoFactorWarning()),
                $q.when(getGlideraTransactions())
            ]).then(function() {
                $scope.isLoading = false;
            }, function (err) {
                console.log('err', err);
            });
        }

        function twoFactorWarning() {
            return $q.when(launchService.getAccountInfo())
                .then(function(accountInfo) {
                    var SECONDS_AGO = 86400;

                    if (!accountInfo.requires2FA) {

                        return settingsService.getSettings()
                            .then(function(settings) {
                                var last = settings.twoFactorWarningLastDisplayed;

                                if (!last || last < (new Date()).getTime() - SECONDS_AGO * 1000) {
                                    var updateSettings = {
                                        twoFactorWarningLastDisplayed: (new Date()).getTime()
                                    };

                                    settingsService.updateSettingsUp(updateSettings);

                                    $scope.isTwoFactorWarning = true;
                                }
                            });
                    }
                });
        }

        function getGlideraTransactions() {
            return settingsService.getSettings().then(function(settings) {
                $scope.buybtcPendingOrders = [];

                settings.glideraTransactions.forEach(function(glideraTxInfo) {
                    if (glideraTxInfo.transactionHash || glideraTxInfo.status === "COMPLETE") {
                        return;
                    }

                    var order = {
                        qty: CurrencyConverter.toSatoshi(glideraTxInfo.qty, 'BTC'),
                        qtyBTC: glideraTxInfo.qty,
                        currency: glideraTxInfo.currency,
                        price: glideraTxInfo.price,
                        total: (glideraTxInfo.price * glideraTxInfo.qty).toFixed(2),
                        time: glideraTxInfo.time,
                        avatarUrl: buyBTCService.BROKERS.glidera.avatarUrl,
                        displayName: buyBTCService.BROKERS.glidera.displayName
                    };

                    $scope.buybtcPendingOrders.push(order);
                });

                // latest first
                $scope.buybtcPendingOrders.reverse();
            });
        }

        function onShowMoreTransactions() {
            if($scope.transactionsListLimit < $scope.walletData.transactions.length) {
                $scope.transactionsListLimit = $scope.transactionsListLimit + transactionsListLimitStep;
            } else if (!$scope.isLoading && $scope.walletData.transactions.length && $scope.transactionsListLimit >= $scope.walletData.transactions.length) {
                $scope.isShowNoMoreTransactions = true;

                if(timeoutPromise) {
                    $timeout.cancel(timeoutPromise);
                }

                timeoutPromise = $timeout(function () {
                    timeoutPromise = null;
                    $scope.isShowNoMoreTransactions = false;
                }, timeoutDelay);
            }
        }

        function isHeader(transaction) {
            var isHeader = false;
            var date = new Date(transaction.time * 1000);

            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);

            if (lastDateHeader !== date.valueOf()) {
                lastDateHeader = date.valueOf();
                isHeader = true;
            }

            return isHeader;
        }

        function getTransactionHeader() {
            return lastDateHeader;
        }

        function onShowTransaction(transaction) {
            $modal.open({
                controller: "WalletTransactionInfoModalCtrl",
                templateUrl: "js/modules/wallet/controllers/wallet-transaction-info-modal/wallet-transaction-info-modal.tpl.html",
                resolve: {
                    data: function() {
                        return {
                            transaction: angular.copy(transaction),
                            localCurrency: settings.localCurrency
                        }
                    }
                }
            });
        }

        function onDestroy() {
            if(timeoutPromise) {
                $timeout.cancel(timeoutPromise);
            }
        }
    }

})();
