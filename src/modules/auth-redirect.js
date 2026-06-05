"use strict"

const hash = window.location.hash

if (hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ""))
    const isInviteCallback = params.get("type") === "invite"
    const isAuthEmailError =
        params.has("error") ||
        params.has("error_code") ||
        params.has("error_description")

    if (isInviteCallback || isAuthEmailError) {
        window.location.replace(`/criar-senha${hash}`)
    }
}
