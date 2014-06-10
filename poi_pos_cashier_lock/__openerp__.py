# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################


{
    'name': 'Point of Sale - Cashier Lock',
    'version': '1.0',
    'category': 'Point Of Sale',
    'sequence': 10,
    'summary': 'Touchscreen Interface for Lock Cashiers',
    'description': """
Point of Sale - Cashier Lock
===========================

This module adds a PIN to cashiers.

This allows to:
* Create a POS with session login
* Close session when a defined time has expired
* Close session when the user close his session

    """,
    'author': 'Poiesis Consulting',
    'depends': ['point_of_sale','poi_pos_extension'],
    'data': [
        'point_of_sale_view.xml',
        'res_users_view.xml',
        'views/templates.xml',
    ],
    'installable': True,
    'application': True,
    'js': ['static/src/js/pos_lock.js'],
    'qweb': ['static/src/xml/pos.xml'],
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
