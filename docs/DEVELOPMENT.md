# Development

This document contains notes and tips on the development of the app.


## Angular

The Angular documentation is available on https://angular.dev/.

### Updating Angular

See https://angular.dev/cli/update.

When updating to a new major version of Angular:

1. See the interactive [Angular update guide][angular_update_guide].
2. Update the line in [`Dockerfile`][dockerfile] which indicates the Angular major version number: `ARG ANGULAR_MAJOR_VERSION=<major_version>`.



## Ionic

The Ionic Framework documentation is available on https://ionicframework.com/docs/

### Updating Ionic

Run `npm install @ionic/angular @ionic/angular-server`.



[angular_update_guide]: https://update.angular.io/
[dockerfile]: ../Dockerfile
