# -*- coding: utf-8 -*-
##############################################################################
#
#    Poiesis Consulting, OpenERP Partner
#    Copyright (C) 2013 Poiesis Consulting (<http://www.poiesisconsulting.com>).
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
    'name': 'Web Alerts',
    'version': '1.0',
    'category': 'web',
    'sequence': 4,
    'summary': 'Web Alerts',
    'description': """
Web Alerts
===================================
To be described soon
    """,
    'author': 'Poiesis Consulting',
    'website': 'http://www.poiesisconsulting.com',
    'depends': ['web'],
    'data': [],
    'installable': True,
    'active': False,
    'application': True,
    'js': [
        'static/lib/noty/jquery.noty.js',
        'static/src/js/web_alerts.js',
    ],
    'qweb': [
        'static/src/xml/web_alerts.xml',
    ]

#    'certificate': 'certificate',
}