# Echo browser extension: privacy policy

This policy covers the Echo browser extension. The extension talks to one Echo server,
the one it was built for or the one you connect it to. Whoever runs that server (the
operator) is responsible for the data stored there; the open-source code is at
https://github.com/voirlabs/echo.

## What the extension reads

- The current page, only when you open the popup on it: its address, title, main
  text, and the visible fields you can type into with their labels. Hidden fields,
  search boxes, passwords, one-time codes and payment fields are left out, and so is
  anything you've typed into the fields. Nothing is read in the background.
- When you choose **Fill**: the page's visible text fields and their labels again, to
  put each drafted value into the field it was drafted for and nowhere else. Nothing is
  submitted.

## Where data goes

- To your Echo server, with your sign-in. Opening the popup sends a sign-in check and the
  page's address, to find the draft for it. Choosing **Copy prompt for your assistant** (or
  **Draft this page again**) sends the page's address, title, text and fields, so your
  assistant can draft for it.
- Nowhere else. The extension calls no AI provider and has no analytics, tracking or
  third parties. Your assistant (Claude or ChatGPT) reads the page from your Echo server
  when you paste the prompt, under that assistant's terms.

## Permissions

- `activeTab` and `scripting`: read and fill the page in the tab where you opened the
  popup, only then.
- `storage`: the address of your Echo server.
- Optional host access (`https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`):
  declared so any server address can work. The extension asks for access only to the one
  server you enter, when you connect it.

The popup also copies the prompt, or a draft, to your clipboard when you choose to.

## What is stored in your browser

- The address of your Echo server, in the extension's local storage, until you change it
  or uninstall the extension.

## Your choices

Delete drafts, profile entries, writing samples or all your data in the Echo web app.

## Changes

Changes to this policy are made in this file in the repository, where its history is
public.
