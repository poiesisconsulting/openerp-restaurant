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
    'name': 'HPH - Module',
    'version': '1.0',
    'category': 'Point Of Sale',
    'sequence': 10,
    'summary': 'Touchscreen Interface for Lock Cashiers',
    'description': """
HPH - Module
===========================

This module adds some custom parameters to HPH

    """,
    'author': 'Poiesis Consulting',
    'depends': ['point_of_sale','poi_pos_extension','poi_pos_cashier_lock','poi_pos_table_designer'],
    'data': ['data/report_paperformat.xml',
             'views/templates.xml',
             'wizard/server_closing_view.xml',
             'poi_x_hph_report.xml',
             'views/report_server_closing.xml'
    ],
    'installable': True,
    'application': True,
    'qweb': ['static/src/xml/pos.xml'],
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
