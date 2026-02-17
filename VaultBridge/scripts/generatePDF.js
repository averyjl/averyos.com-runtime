const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');

// Setup credentials
const credentials = PDFServicesSdk.Credentials
  .serviceAccountCredentialsBuilder()
  .fromFile("pdfservices-api-credentials.json")
  .build();

// Fill in .md or .txt into the PDF
