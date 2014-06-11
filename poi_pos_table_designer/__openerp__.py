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
    'name': 'Point of Sale - Table Designer',
    'version': '1.0',
    'category': 'Point Of Sale',
    'sequence': 10,
    'summary': 'Touchscreen Interface for Restaurants',
    'description': """
Point of Sale - Table Designer
==============================

This module adds table functionality for restaurants.

This allows to:
* Create tables
* Create seats
* Assign seats

    """,
    'author': 'Poiesis Consulting',
    'depends': ['point_of_sale','poi_pos_cashier_lock','web', 'poi_product_property', 'poi_pos_inventory'],
    'installable': True,
    'application': True,
    'data': ['table_designer_view.xml',
             'reservation_sequence.xml',
             'wizard/waiting_queue_allow_state_view.xml',
             'wizard/table_assigner_view.xml',
             'wizard/table_menu_view.xml',
             'wizard/table_merge_view.xml',
             'reservation_view.xml',
             'point_of_sale_view.xml',
             'point_of_sale_table_data.xml',
             'security/ir.model.access.csv',
             'views/templates.xml',
             'report/daily_report_view.xml',
             'report/pos_rest_report_view.xml'
             ],
    'js': ['static/lib/jquery.gridster.js',
           'static/src/js/main.js',
           'static/src/js/table_designer.js',
           'static/src/js/pos_load_data.js',
           'static/src/js/pos_models.js',
           'static/src/js/pos_screens.js',
           'static/src/js/pos_synch.js',
           'static/src/js/pos_widgets.js'],
    'qweb': ['static/src/xml/pos.xml',
             'static/src/xml/table_designer.xml'],
    'css': ['static/lib/jquery.gridster.css',
            'static/src/css/pos.css'],
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
