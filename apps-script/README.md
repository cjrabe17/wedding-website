# RSVP backend (Google Sheet)

`rsvp.gs` runs inside the wedding Google Sheet as a Web app. It does two things:

- **Looks up invitations.** When a guest types their name on the RSVP page, the script checks the **Guests** tab and returns only that guest's party. The full guest list never goes to the website or into this repo.
- **Saves RSVPs** to the **RSVPs** tab, one row per guest (plus ones included). RSVPs from names that aren't on the guest list are rejected.

The website calls it at the `RSVP_ENDPOINT` URL at the top of `script.js`.

## Guests tab

| Party | Name |
|---|---|
| 1 | Jane Smith |
| 1 | John Smith |
| 2 | Alex Doe |
| 2 | Plus one |

- Row 1 is the header. Everyone with the same **Party** value RSVPs together. The value can be a number or a label like "Smith family".
- A row named `Plus one` lets that party bring a guest. They'll be asked for the guest's name. Typing `+1` also works, even though Sheets turns it into `=+1`.
- Guests can find themselves by full name or by any part of it, such as first name, last name, or "de la Cruz". Partial words like "Smi" don't match.
- Changes take effect immediately. You don't need to redeploy after editing the guest list.

## Updating the script

Paste the new code over the old in **Extensions → Apps Script**, click **Save**, then go to **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**. The URL stays the same, so `script.js` doesn't change.

## First-time setup (already done)

**Deploy → New deployment →** ⚙️ **Web app**, with **Execute as: Me** and **Who has access: Anyone**, then authorize. "Anyone" only means anyone can call the script. The sheet itself stays private.

## RSVPs tab

| Submitted | Submission ID | Party | Responded by | Guest | Type | Attending | Dietary / notes | Note for the couple |
|---|---|---|---|---|---|---|---|---|

- Rows from one RSVP share a **Submission ID**.
- If a party RSVPs more than once, every submission is kept. The latest **Submitted** time is their current answer.
- A plus one who isn't coming shows as `(no guest)` with Attending `No`.
