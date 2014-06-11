#!/usr/bin/env python
# -*- coding: utf-8 -*-
##############################################################################
#    
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2010 Poiesis Consulting (<http://www.poiesisconsulting.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it wiffll be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.     
#
##############################################################################
{
    "name" : "Point of Sale - Base Extension",
    "version" : "1.0",
    "sequence": 3,
    "category": "Point Of Sale",
    "depends" : ["point_of_sale",],
    "author" : "Poiesis Consulting",
    'description': """
Point of Sale Base Extension
===================================
Any module based on point_of_sale must work with this.

This overrides the native functions of OpenERP that can't be inherited to make them inheritable.

* All the point_of_sale addons must work with this.
    """,
    'author': 'Poiesis Consulting',
    'website': 'http://www.poiesisconsulting.com',
    'data':['point_of_sale_view.xml',
            'views/templates.xml'],
    'installable': True,
    'active': False,
    'application': True,
    'js': ['static/src/js/main.js',
           'static/src/js/models.js',
           'static/src/js/screens.js',
           'static/src/js/synch.js'],
    'qweb': ['static/src/xml/extension.xml'],
    'css': [],
}
