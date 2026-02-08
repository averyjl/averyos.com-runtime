---
name: Bug/Drift Report
about: Create a report to help us improve
title: AveryOS-Runtime Bug/Drift Report
labels: Bug/Drift Report
assignees: averyjl

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Desktop (please complete the following information):**
 - OS: [e.g. iOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Smartphone (please complete the following information):**
 - Device: [e.g. iPhone6]
 - OS: [e.g. iOS8.1]
 - Browser [e.g. stock browser, safari]
 - Version [e.g. 22]

**Additional context**
name: 🐛 Drift / Bug Report
description: Report bugs or suspected runtime drift
body:
  - type: input
    id: drift_sha
    attributes:
      label: SHA of Affected Capsule
      placeholder: ex. cf83e1357...
  - type: textarea
    id: description
    attributes:
      label: What happened?
  - type: checkboxes
    id: license
    attributes:
      label: License Confirmation
      options:
        - label: I confirm I hold a valid AveryOS license
