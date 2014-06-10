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
    'name': 'Point of Sale - Authorization Approval',
    'version': '1.0',
    'category': 'Point Of Sale',
    'sequence': 10,
    'summary': 'Point of Sale Authorization Approval',
    'description': """
Point of Sale - Authorization Approval
===========================

This module adds authorization approval to Point of Sale

    """,
    'author': 'Poiesis Consulting',
    'depends': ['point_of_sale','poi_mail','poi_web_alert'],
    'data': [
        'point_of_sale_view.xml',
        'views/templates.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': True,
    'js': ['static/src/js/pos.js'],
    'qweb': ['static/src/xml/pos.xml'],
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
