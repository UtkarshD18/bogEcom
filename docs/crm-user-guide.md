# BuyOneGram CRM - Non-Technical User Guide

## Purpose
This guide explains how to use the CRM screen to view contacts and send WhatsApp messages or campaigns. It is written for non-technical users.

---

## 1) CRM Contacts List

### What you see
- A table of contacts with their stage, status, spend, and last activity.
- Filters for Search, Channel, Lifecycle, and Status.

### What to do
- Use Search to find a customer by name, email, or phone.
- Click a contact row to open their details and messaging tools.
- Use Clear Filters to reset the list.

---

## 2) Contact Details (Right Side Card)

### What you see
- Contact stage and status
- Consent flags (WhatsApp, Email, Push)
- Phone number and recent activity

### What to do
- If WhatsApp Consent is not "Allowed", update it before sending WhatsApp messages.
- Click Save Contact after changing stage, status, or consent.

---

## 3) WhatsApp Message Center (Single Contact)

### When to use
- Use this for one customer at a time.

### Step A - Choose Send Mode
- Personal Text Reply
- Template Message
- Image Message
- GIF Message

### Step B - Fill the fields (by mode)

#### A) Personal Text Reply
Use this only if the customer already chatted with you.
- Message: type your message
- Campaign Label (optional): type any label like `Support Follow-up`

#### B) Template Message (Recommended for first outreach)
- Approved Template: select from dropdown
- Language Code: must match template (example: `en` or `en_US`)
- Header Variables: only if your template header has variables
- Body Variables: values for {{1}}, {{2}}, etc.
  - Example body: "Hi {{1}}, your offer is {{2}}"
  - Body Variables: `Ravi, 20% OFF`

#### C) Image Message
- Click Upload Media
- Select an image file from your computer
- Caption (optional): add a short text below the image

#### D) GIF Message
- Click Upload Media
- Select a GIF or MP4 file from your computer
- Caption (optional): add a short text below the GIF/video

### Step C - Send
- Click Send WhatsApp Message
- You will see a confirmation popup before it sends

---

## 4) WhatsApp Campaigns (Mass Messaging)

### When to use
- Use this to send templates to many contacts at once.

### Step A - Fill the campaign form
- Audience Segment: choose who receives the message
  - All Consented Contacts
  - Customers
  - Inactive
  - VIP
- Inactive Window (days): use 45 unless told otherwise
- Approved Template: choose from dropdown
- Language Code: must match template (example: `en`, `en_US`)
- Header Variables: only if the template header has variables
- Body Variables: enter values for {{1}}, {{2}}, etc.
- Campaign Label: any label like `April Winback`

### Step B - Check audience preview
- Click Refresh Preview
- You should see the number of contacts who will receive it

### Step C - Send
- Click Send WhatsApp Campaign
- Confirm the popup

---

## 5) Common Field Examples

### Template with 2 variables
Template body:
"Hi {{1}}, enjoy {{2}} today!"

Body Variables:
- Line 1: Customer Name
- Line 2: Offer text

Example:
- `Amit`
- `15% OFF on Peanut Butter`

### Template with no variables
- Body Variables: leave empty
- Header Variables: leave empty

---

## 6) Status Messages You Might See

- API Needs Config: WhatsApp credentials are invalid or expired
- Template Sync Manual: approved templates could not be pulled

If you see these errors, contact the tech team.

---

## 7) Quick Checklist

Before sending a message:
- Contact is selected
- WhatsApp consent is Allowed
- Template name and language match
- Variables match the template count
- For media: file uploaded from your PC

---

## 8) Need Help?

If a send fails or delivery does not happen:
- Confirm the WhatsApp API health status in the CRM panel
- Confirm the correct template is approved by Meta
- Contact the admin or tech team for assistance
