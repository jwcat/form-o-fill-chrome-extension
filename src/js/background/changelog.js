/*eslint no-unused-vars: 0 */
var Changelog = {
  changes: {
    "2.0.0": {
      title: "2.0.0 : Workflows have arrived!",
      message: "Chain rules together to form sequences of actions. Even survives page reload!",
      target: "#workflows"
    },
    "2.2.1": {
      title: "FoF updated: Save data between rules!",
      message: "Save data between rule executions. Ideal for workflows.",
      target: "#help-before-context"
    },
    "2.2.2": {
      title: "FoF updated: Unified export/import!",
      message: "Unified export/import for rules & workflows. See changelog!",
      target: "#changelog"
    },
    "2.3.0": {
      title: "FoF updated: Live tutorials!",
      message: "Learn the features of FoF with the live tutorials. See options.",
      target: "#tutorials"
    },
    "2.3.1": {
      title: "FoF updated: More tutorials!",
      message: "Added tutorials for workflows, context and more. Have a look!",
      target: "#tutorials"
    },
    "2.4.0": {
      title: "FoF updated: Screenshot + onlyEmpty",
      message: "Take screenshots! Fill only empty fields!",
      target: "#help-screenshot"
    }
  },
  findForVersion: function(version) {
    if(typeof this.changes[version] !== "undefined") {
      return this.changes[version];
    }
    return null;
  }
};
