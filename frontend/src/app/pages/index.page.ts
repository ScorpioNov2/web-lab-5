import { RouteMeta } from '@analogjs/router';
import { Component } from '@angular/core';
import { accessGuard } from '../core/auth/access.guard';

// "/" is only a doorway: the access rules send a signed-in user to /students, a guest to /login.
export const routeMeta = {
	canActivate: [accessGuard],
} satisfies RouteMeta;

@Component({ selector: 'app-home-page', template: '' })
export default class HomePage {}
