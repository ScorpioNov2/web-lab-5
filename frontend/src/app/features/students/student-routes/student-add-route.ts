import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/http/api-error';
import { AlertService } from '../../../shared/ui/alert/alert.service';
import { StudentModal, StudentModalState, StudentSaveEvent } from '../student-modal/student-modal';
import { StudentApi } from '../student.api';

/** /students/new (ADMIN): the "add student" popup on top of the table. */
@Component({
	selector: 'app-student-add-route',
	imports: [StudentModal],
	template: `<app-student-modal [state]="state" (closed)="close()" (save)="save($event)" />`,
})
export class StudentAddRoute {
	private readonly api = inject(StudentApi);
	private readonly alert = inject(AlertService);
	private readonly router = inject(Router);

	protected readonly state: StudentModalState = { mode: 'add', student: null };

	protected close(): void {
		void this.router.navigate(['/students'], { queryParamsHandling: 'preserve' });
	}

	protected async save(event: StudentSaveEvent): Promise<void> {
		if (event.mode !== 'add') return;
		try {
			await firstValueFrom(this.api.create(event.data));
			this.alert.success('Студент успешно добавлен!');
			this.close();
		} catch (error) {
			console.error('[Form Submit Error]', error);
			// The popup stays open so the user can correct the data (e.g. duplicate ISU ID).
			this.alert.error(errorMessage(error, 'Ошибка при сохранении данных!'));
		}
	}
}
