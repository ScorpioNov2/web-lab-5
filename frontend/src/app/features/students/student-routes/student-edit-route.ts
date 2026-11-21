import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/http/api-error';
import { Loaded } from '../../../core/http/loaded';
import { AlertService } from '../../../shared/ui/alert/alert.service';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { ModalShell } from '../../../shared/ui/modal-shell/modal-shell';
import { StudentModal, StudentSaveEvent } from '../student-modal/student-modal';
import { StudentApi } from '../student.api';
import { Student } from '../student.model';

/** /students/[id]/edit (ADMIN): the edit popup on top of the table. */
@Component({
	selector: 'app-student-edit-route',
	imports: [StudentModal, ModalShell, ErrorState],
	template: `
		@if (student(); as student) {
			<app-student-modal
				[state]="{ mode: 'edit', student }"
				(closed)="close()"
				(save)="save($event)"
				(cancelEdit)="backToView($event)"
			/>
		} @else if (error(); as failure) {
			<app-modal-shell
				[title]="
					failure.status === 404 ? 'Студент не найден' : 'Редактирование данных студента'
				"
				(closed)="close()"
			>
				<app-error-state
					[status]="failure.status"
					[message]="
						failure.status === 404
							? 'Студента с таким ИСУ ID нет в базе. Возможно, его уже удалили.'
							: failure.message
					"
					(retry)="reload()"
				/>
			</app-modal-shell>
		}
	`,
})
export class StudentEditRoute {
	private readonly api = inject(StudentApi);
	private readonly alert = inject(AlertService);
	private readonly router = inject(Router);

	/** The resolver's answer (`resolve: { result: studentResolver }`), bound by the router. */
	readonly result = input.required<Loaded<Student>>();

	protected readonly student = computed(() => {
		const result = this.result();
		return result.ok ? result.data : null;
	});
	protected readonly error = computed(() => {
		const result = this.result();
		return result.ok ? null : result.error;
	});

	protected close(): void {
		void this.router.navigate(['/students'], { queryParamsHandling: 'preserve' });
	}

	/** "Отмена" in the edit form: back to the read-only view. */
	protected backToView(isuId: number): void {
		void this.router.navigate(['/students', isuId], { queryParamsHandling: 'preserve' });
	}

	protected reload(): void {
		void this.router.navigate([], {
			queryParamsHandling: 'preserve',
			onSameUrlNavigation: 'reload',
		});
	}

	protected async save(event: StudentSaveEvent): Promise<void> {
		if (event.mode !== 'edit') return;
		try {
			await firstValueFrom(this.api.update(event.isuId, event.data));
			this.alert.success('Данные студента обновлены!');
			this.close();
		} catch (error) {
			console.error('[Form Submit Error]', error);
			// The popup stays open so the user can correct the data (e.g. duplicate ISU ID).
			this.alert.error(errorMessage(error, 'Ошибка при сохранении данных!'));
		}
	}
}
