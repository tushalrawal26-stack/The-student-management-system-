"use strict";

var CACHE_NAME = "jarvis-shell-v3";
var APP_SHELL = [
    "./testing_cade_X.html",
    "./expenses.html",
    "./study.html",
    "./todos.html",
    "./manifest.webmanifest",
    "./assets/dashboard.css",
    "./assets/dashboard.js",
    "./icons/jarvis-192.png",
    "./icons/jarvis-512.png",
    "./icons/jarvis.svg"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) { return cache.addAll(APP_SHELL); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(cacheNames.map(function (cacheName) {
                    if (cacheName.indexOf("jarvis-shell-") === 0 && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith((async function () {
            try {
                var response = await fetch(request);
                if (response.ok) {
                    var cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                var cachedPage = await caches.match(request);
                return cachedPage || caches.match(new URL("./testing_cade_X.html", self.registration.scope).href);
            }
        }()));
        return;
    }

    event.respondWith((async function () {
        var cached = await caches.match(request);
        if (cached) return cached;
        var response = await fetch(request);
        if (response.ok) {
            var cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    }()));
});
