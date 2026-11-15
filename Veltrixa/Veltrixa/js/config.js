/* Veltrixa settings.
   The backend developer only needs USE_MOCK and API_BASE_URL.
   (In the JSP pages, data-api-base on the body tag sets this automatically.) */
window.VELTRIXA_CONFIG = {
    // true = use the mock server in the browser (js/mock-server.js + data/mock-data.json)
    // false = send real requests to the Java backend
    USE_MOCK: true,

    // base URL of the Java REST API, the endpoints are in docs/API-INTEGRATION.md
    API_BASE_URL: "/api",

    // only for mock mode
    MOCK_DATA_URL: "data/mock-data.json",
    MOCK_DELAY_MS: 450,          // fake delay so the loading spinner can be seen

    // lists
    DEFAULT_PAGE_SIZE: 6,
    PAGE_SIZES: [6, 12, 24],

    // attachments (set ATTACHMENTS_ENABLED to false to hide the tab)
    ATTACHMENTS_ENABLED: true,
    MAX_ATTACHMENT_MB: 5,
    ALLOWED_ATTACHMENT_EXT: ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "txt", "zip"],

    REQUEST_TIMEOUT_MS: 15000
};
