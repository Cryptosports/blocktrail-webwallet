(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

    function AccountSecurityService(CONFIG, settingsService, $http, launchService, sdkService) {

        function getSecurityScore() {

            var settings = settingsService.getReadOnlySettingsData();

            var score = 0.35 * settings.verifiedEmail + 0.35 * (settings.passwordScore / 4);

            return launchService.getAccountInfo().then(function (accountInfo) {
                if (accountInfo.requires2FA) {
                    score += 0.3 * accountInfo.requires2FA
                }

                console.log('SCORE', score, {
                    pwscore: settings.passwordScore,
                    requ2fa: accountInfo.requires2FA
                });

                return score * 100;
            });
        }

        function verifyEmail(token) {
            var settings = settingsService.getReadOnlySettingsData();
            console.log(settings);

            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email",
                { verify_token: token }
            );
        }

        return {
            verifyEmail: verifyEmail,
            getSecurityScore: getSecurityScore
        };
    }
})();
