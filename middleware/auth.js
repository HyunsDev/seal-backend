const express = require('express')
const jwt = require('jsonwebtoken')

export function tokenCheck(req, res, next) {
    if (!req.header('Authorization')) {
        res.status(401).json({
            code: 'invalid_token',
        });
        return
    }

    try {
        const token = req.header('Authorization')?.replace('Bearer ', '') || '';
        req.token = jwt.verify(token, process.env.JWT_SECRET || '');
        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            res.status(401).json({
                code: 'token_expired',
            });
        } else {
            res.status(401).json({
                code: 'invalid_token',
            });
        }
    }
}