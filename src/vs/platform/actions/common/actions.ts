/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import URI from 'vs/base/common/uri';
import { IAction, Action } from 'vs/base/common/actions';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { SyncDescriptor0, createSyncDescriptor, AsyncDescriptor0 } from 'vs/platform/instantiation/common/descriptors';
import { IConstructorSignature2, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindings } from 'vs/platform/keybinding/common/keybinding';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IDisposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';

export interface ICommandAction {
	id: string;
	title: string;
	category?: string;
	iconClass?: string;
}

export interface IMenu extends IDisposable {
	onDidChange: Event<IMenu>;
	getActions(): [string, IAction[]][];
}

export interface IMenuItem {
	command: ICommandAction;
	alt?: ICommandAction;
	when?: ContextKeyExpr;
	group?: 'navigation' | string;
	order?: number;
}

export enum MenuId {
	EditorTitle = 1,
	EditorContext = 2,
	ExplorerContext = 3,
	EditorTabContext = 4
}

export const IMenuService = createDecorator<IMenuService>('menuService');

export interface IMenuService {

	_serviceBrand: any;

	createMenu(id: MenuId, scopedKeybindingService: IContextKeyService): IMenu;

	getCommandActions(): ICommandAction[];
}

export interface IMenuRegistry {
	commands: { [id: string]: ICommandAction };
	addCommand(userCommand: ICommandAction): boolean;
	getCommand(id: string): ICommandAction;
	appendMenuItem(menu: MenuId, item: IMenuItem): IDisposable;
	getMenuItems(loc: MenuId): IMenuItem[];
}

export const MenuRegistry: IMenuRegistry = new class {

	commands: { [id: string]: ICommandAction } = Object.create(null);

	menuItems: { [loc: number]: IMenuItem[] } = Object.create(null);

	addCommand(command: ICommandAction): boolean {
		const old = this.commands[command.id];
		this.commands[command.id] = command;
		return old !== void 0;
	}

	getCommand(id: string): ICommandAction {
		return this.commands[id];
	}

	appendMenuItem(loc: MenuId, item: IMenuItem): IDisposable {
		let array = this.menuItems[loc];
		if (!array) {
			this.menuItems[loc] = array = [item];
		} else {
			array.push(item);
		}
		return {
			dispose() {
				const idx = array.indexOf(item);
				if (idx >= 0) {
					array.splice(idx, 1);
				}
			}
		};
	}

	getMenuItems(loc: MenuId): IMenuItem[] {
		return this.menuItems[loc] || [];
	}
};


export class MenuItemAction extends Action {

	private static _getMenuItemId(item: IMenuItem): string {
		let result = item.command.id;
		if (item.alt) {
			result += `||${item.alt.id}`;
		}
		return result;
	}

	private _resource: URI;

	constructor(
		private _item: IMenuItem,
		@ICommandService private _commandService: ICommandService
	) {
		super(MenuItemAction._getMenuItemId(_item), _item.command.title);

		this.order = this._item.order; //TODO@Ben order is menu item property, not an action property
	}

	set resource(value: URI) {
		this._resource = value;
	}

	get resource() {
		return this._resource;
	}

	get item(): IMenuItem {
		return this._item;
	}

	get command() {
		return this._item.command;
	}

	get altCommand() {
		return this._item.alt;
	}

	run(alt: boolean) {
		const {id} = alt === true && this._item.alt || this._item.command;
		return this._commandService.executeCommand(id, this._resource);
	}
}


export class ExecuteCommandAction extends Action {

	constructor(
		id: string,
		label: string,
		@ICommandService private _commandService: ICommandService) {

		super(id, label);
	}

	run(...args: any[]): TPromise<any> {
		return this._commandService.executeCommand(this.id, ...args);
	}
}

export class SyncActionDescriptor {

	private _descriptor: SyncDescriptor0<Action>;

	private _id: string;
	private _label: string;
	private _keybindings: IKeybindings;
	private _keybindingContext: ContextKeyExpr;
	private _keybindingWeight: number;

	constructor(ctor: IConstructorSignature2<string, string, Action>,
		id: string, label: string, keybindings?: IKeybindings, keybindingContext?: ContextKeyExpr, keybindingWeight?: number
	) {
		this._id = id;
		this._label = label;
		this._keybindings = keybindings;
		this._keybindingContext = keybindingContext;
		this._keybindingWeight = keybindingWeight;
		this._descriptor = createSyncDescriptor(ctor, this._id, this._label);
	}

	public get syncDescriptor(): SyncDescriptor0<Action> {
		return this._descriptor;
	}

	public get id(): string {
		return this._id;
	}

	public get label(): string {
		return this._label;
	}

	public get keybindings(): IKeybindings {
		return this._keybindings;
	}

	public get keybindingContext(): ContextKeyExpr {
		return this._keybindingContext;
	}

	public get keybindingWeight(): number {
		return this._keybindingWeight;
	}
}

/**
 * A proxy for an action that needs to load code in order to confunction. Can be used from contributions to defer
 * module loading up to the point until the run method is being executed.
 */
export class DeferredAction extends Action {
	private _cachedAction: IAction;
	private _emitterUnbind: IDisposable;

	constructor(private _instantiationService: IInstantiationService,
		private _descriptor: AsyncDescriptor0<Action>,
		id: string, label = '', cssClass = '', enabled = true) {

		super(id, label, cssClass, enabled);
	}

	public get cachedAction(): IAction {
		return this._cachedAction;
	}

	public set cachedAction(action: IAction) {
		this._cachedAction = action;
	}

	public get id(): string {
		if (this._cachedAction instanceof Action) {
			return this._cachedAction.id;
		}

		return this._id;
	}

	public get label(): string {
		if (this._cachedAction instanceof Action) {
			return this._cachedAction.label;
		}

		return this._label;
	}

	public set label(value: string) {
		if (this._cachedAction instanceof Action) {
			this._cachedAction.label = value;
		} else {
			this._setLabel(value);
		}
	}

	public get class(): string {
		if (this._cachedAction instanceof Action) {
			return this._cachedAction.class;
		}

		return this._cssClass;
	}

	public set class(value: string) {
		if (this._cachedAction instanceof Action) {
			this._cachedAction.class = value;
		} else {
			this._setClass(value);
		}
	}

	public get enabled(): boolean {
		if (this._cachedAction instanceof Action) {
			return this._cachedAction.enabled;
		}
		return this._enabled;
	}

	public set enabled(value: boolean) {
		if (this._cachedAction instanceof Action) {
			this._cachedAction.enabled = value;
		} else {
			this._setEnabled(value);
		}
	}

	public get order(): number {
		if (this._cachedAction instanceof Action) {
			return (<Action>this._cachedAction).order;
		}
		return this._order;
	}

	public set order(order: number) {
		if (this._cachedAction instanceof Action) {
			(<Action>this._cachedAction).order = order;
		} else {
			this._order = order;
		}
	}

	public run(event?: any): Promise {
		if (this._cachedAction) {
			return this._cachedAction.run(event);
		}
		return this._createAction().then((action: IAction) => {
			return action.run(event);
		});
	}

	private _createAction(): TPromise<IAction> {
		let promise = TPromise.as(undefined);
		return promise.then(() => {
			return this._instantiationService.createInstance(this._descriptor);
		}).then(action => {
			if (action instanceof Action) {
				this._cachedAction = action;
				// Pipe events from the instantated action through this deferred action
				this._emitterUnbind = action.onDidChange(e => this._onDidChange.fire(e));

			} else {
				throw new Error('Action must be an instanceof Base Action');
			}

			return action;
		});
	}

	public dispose(): void {
		if (this._emitterUnbind) {
			this._emitterUnbind.dispose();
		}
		if (this._cachedAction) {
			this._cachedAction.dispose();
		}
		super.dispose();
	}
}