'use strict';
// TODO: Phase 2 — verify operator_token cookie; check token.version === operator.tokenVersion;
//                 require twoFactorCompleted: true claim; set req.actor
module.exports = (req, res, next) => next();
