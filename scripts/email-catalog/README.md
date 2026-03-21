# Email Catalog Generator

Generates branded HTML email templates from a DOCX, captures screenshots, and combines them into a PDF catalog.

## Output

- HTML files: `../../emails`
- Screenshots: `../../screenshots`
- PDF: `../../email_catalog.pdf`

## Install

```bash
cd scripts/email-catalog
npm install
```

## Run

```bash
npm start -- --doc ../../EMAILS.docx
```

Optional arguments:

- `--doc <path>`: source DOCX path
- `--emailsDir <path>`: output directory for HTML files
- `--screenshotsDir <path>`: output directory for PNG screenshots
- `--output <path>`: output PDF path

## Notes

- Uses realistic dummy values for all templates.
- Includes a PDF cover page and page numbers.
- Generated metadata is saved to `../../email-catalog-report.json`.
