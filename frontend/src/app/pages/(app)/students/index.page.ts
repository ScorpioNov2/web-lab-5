import { RouteMeta } from '@analogjs/router';
import { Component } from '@angular/core';
import { accessGuard } from '../../../core/auth/access.guard';

// /students: just the table (no popup) - the layout draws it.
export const routeMeta = {
	title: 'Студенты - Система Заявок Студентов',
	canActivate: [accessGuard],
} satisfies RouteMeta;

@Component({ selector: 'app-students-index', template: '' })
export default class StudentsIndex {}
