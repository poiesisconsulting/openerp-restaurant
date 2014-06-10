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
    'name': 'Restaurant by Poiesis',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Restaurant extensions for the Point of Sale ',
    'description': """

=======================

This module adds several restaurant features to the Point of Sale:
- Bill Printing: Allows you to print a receipt before the order is paid
- Bill Splitting: Allows you to split an order into different orders
- Kitchen Order Printing: allows you to print orders updates to kitchen or bar printers

""",
    'author': 'OpenERP SA',
    'depends': ['point_of_sale','poi_pos_extension','poi_pos_table_designer'],
    'data': [
        'restaurant_view.xml',
        'security/ir.model.access.csv',
        'views/templates.xml',
    ],
    'js': [
        'static/src/js/multiprint.js',
        'static/src/js/courseprint.js',
        'static/src/js/splitbill.js',
        'static/src/js/printbill.js',
        'static/src/js/screens.js',
        'static/src/js/widgets.js',
        'static/src/js/main.js',
    ],
    'qweb':[
        'static/src/xml/multiprint.xml',
        'static/src/xml/courseprint.xml',
        'static/src/xml/splitbill.xml',
        'static/src/xml/printbill.xml',
    ],
    'test': [
    ],
    'installable': True,
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
