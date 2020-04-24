/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import URI from '@theia/core/lib/common/uri';

export namespace OutputUri {

    export const SCHEME = 'output';

    /**
     * Unique URI of the empty, placeholder `Output` text-model.
     */
    export const EMPTY = create('empty-eca3b566-4eb4-4456-88b4-e8a59d1d7a58');

    export function is(uri: string | URI): boolean {
        if (uri instanceof URI) {
            return uri.scheme === SCHEME;
        }
        return is(new URI(uri));
    }

    export function create(name: string): URI {
        return new URI(name).withScheme(SCHEME);
    }

}
